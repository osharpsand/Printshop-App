const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tar = require('tar');

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function getArchiveEntries(directory, archiveName) {
    const entries = new Set([archiveName]);

    function addDirectoryEntries(currentDirectory, relativeDirectory) {
        for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
            const relativePath = path.posix.join(relativeDirectory, entry.name);
            entries.add(path.posix.join(archiveName, relativePath));

            if (entry.isDirectory()) {
                addDirectoryEntries(path.join(currentDirectory, entry.name), relativePath);
            }
        }
    }

    addDirectoryEntries(directory, '');
    return entries;
}

async function readArchiveEntries(archivePath) {
    const entries = new Set();

    await tar.t({
        file: archivePath,
        onentry: entry => entries.add(entry.path.replace(/\/+$/, ''))
    });

    return entries;
}

function moveOrderToArchive(orderPath, archiveDirectory, completedAt = new Date()) {
    const orderFilename = path.basename(orderPath);

    if (!/^\d+\.json$/.test(orderFilename)) {
        throw new Error('Invalid order filename');
    }

    const dateDirectory = path.join(archiveDirectory, getLocalDateString(completedAt));
    const destinationPath = path.join(dateDirectory, orderFilename);
    fs.mkdirSync(dateDirectory, { recursive: true });

    if (fs.existsSync(destinationPath)) {
        if (fs.existsSync(orderPath) && fs.readFileSync(orderPath).equals(fs.readFileSync(destinationPath))) {
            fs.unlinkSync(orderPath);
        } else if (fs.existsSync(orderPath)) {
            throw new Error(`An archived order already exists at ${destinationPath}`);
        }

        return destinationPath;
    }

    try {
        fs.renameSync(orderPath, destinationPath);
    } catch (error) {
        if (error.code !== 'EXDEV') {
            throw error;
        }

        const temporaryPath = path.join(dateDirectory, `.${orderFilename}.${crypto.randomUUID()}.tmp`);

        try {
            fs.copyFileSync(orderPath, temporaryPath, fs.constants.COPYFILE_EXCL);
            fs.renameSync(temporaryPath, destinationPath);
            fs.unlinkSync(orderPath);
        } catch (copyError) {
            if (fs.existsSync(temporaryPath)) {
                fs.unlinkSync(temporaryPath);
            }
            throw copyError;
        }
    }

    return destinationPath;
}

async function archiveOrderDay(archiveDirectory, dateDirectoryName) {
    const dateDirectory = path.join(archiveDirectory, dateDirectoryName);
    const archivePath = path.join(archiveDirectory, `${dateDirectoryName}.tar.gz`);
    const expectedEntries = getArchiveEntries(dateDirectory, dateDirectoryName);

    if (fs.existsSync(archivePath)) {
        const archivedEntries = await readArchiveEntries(archivePath);

        for (const entry of expectedEntries) {
            if (!archivedEntries.has(entry)) {
                throw new Error(`Existing archive ${archivePath} is missing ${entry}`);
            }
        }

        fs.rmSync(dateDirectory, { recursive: true });
        return archivePath;
    }

    const temporaryArchivePath = `${archivePath}.tmp-${process.pid}-${crypto.randomUUID()}`;

    try {
        await tar.c({
            cwd: archiveDirectory,
            file: temporaryArchivePath,
            gzip: true,
            portable: true
        }, [dateDirectoryName]);

        const archivedEntries = await readArchiveEntries(temporaryArchivePath);
        for (const entry of expectedEntries) {
            if (!archivedEntries.has(entry)) {
                throw new Error(`Created archive ${temporaryArchivePath} is missing ${entry}`);
            }
        }

        fs.renameSync(temporaryArchivePath, archivePath);
        fs.rmSync(dateDirectory, { recursive: true });
        return archivePath;
    } catch (error) {
        if (fs.existsSync(temporaryArchivePath)) {
            fs.unlinkSync(temporaryArchivePath);
        }
        throw error;
    }
}

async function archiveCompletedOrderDays(archiveDirectory, today = new Date()) {
    fs.mkdirSync(archiveDirectory, { recursive: true });

    const todayString = getLocalDateString(today);
    const completedDays = fs.readdirSync(archiveDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < todayString)
        .map(entry => entry.name)
        .sort();
    const errors = [];

    for (const dateDirectoryName of completedDays) {
        try {
            await archiveOrderDay(archiveDirectory, dateDirectoryName);
        } catch (error) {
            errors.push(new Error(`Unable to archive ${dateDirectoryName}: ${error.message}`, { cause: error }));
        }
    }

    if (errors.length > 0) {
        throw new AggregateError(errors, `Unable to archive ${errors.length} completed order day(s)`);
    }
}

module.exports = {
    archiveCompletedOrderDays,
    moveOrderToArchive
};
