const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tar = require('tar');
const { afterEach, test } = require('node:test');
const { archiveCompletedOrderDays, moveOrderToArchive } = require('../order-archive');

let testDirectory;

function createTestDirectory() {
    testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'printshop-order-archive-'));
    return testDirectory;
}

afterEach(() => {
    if (testDirectory && fs.existsSync(testDirectory)) {
        fs.rmSync(testDirectory, { recursive: true, force: true });
    }
    testDirectory = undefined;
});

test('finished orders are moved into their local-date folder', () => {
    const root = createTestDirectory();
    const ordersDirectory = path.join(root, 'orders');
    const archiveDirectory = path.join(root, 'archive');
    const orderPath = path.join(ordersDirectory, '123.json');
    const completedAt = new Date(2026, 0, 2, 12);
    const orderContents = '{"order":"test"}';

    fs.mkdirSync(ordersDirectory);
    fs.writeFileSync(orderPath, orderContents);

    const archivedOrderPath = moveOrderToArchive(orderPath, archiveDirectory, completedAt);

    assert.equal(archivedOrderPath, path.join(archiveDirectory, '2026-01-02', '123.json'));
    assert.equal(fs.readFileSync(archivedOrderPath, 'utf8'), orderContents);
    assert.equal(fs.existsSync(orderPath), false);
});

test('completed days are compressed and current-day orders remain uncompressed', async () => {
    const archiveDirectory = path.join(createTestDirectory(), 'archive');
    const completedDirectory = path.join(archiveDirectory, '2026-01-02');
    const currentDirectory = path.join(archiveDirectory, '2026-01-03');
    const completedOrder = path.join(completedDirectory, '123.json');

    fs.mkdirSync(completedDirectory, { recursive: true });
    fs.mkdirSync(currentDirectory, { recursive: true });
    fs.writeFileSync(completedOrder, '{"order":"completed"}');
    fs.writeFileSync(path.join(currentDirectory, '456.json'), '{"order":"current"}');

    await archiveCompletedOrderDays(archiveDirectory, new Date(2026, 0, 3, 0));

    const archivePath = path.join(archiveDirectory, '2026-01-02.tar.gz');
    const archiveEntries = new Set();
    await tar.t({
        file: archivePath,
        onentry: entry => archiveEntries.add(entry.path.replace(/\/+$/, ''))
    });

    assert.equal(archiveEntries.has('2026-01-02/123.json'), true);
    assert.equal(fs.existsSync(completedDirectory), false);
    assert.equal(fs.existsSync(path.join(currentDirectory, '456.json')), true);
});

test('source orders remain when an existing archive is incomplete', async () => {
    const archiveDirectory = path.join(createTestDirectory(), 'archive');
    const completedDirectory = path.join(archiveDirectory, '2026-01-02');
    const laterDirectory = path.join(archiveDirectory, '2026-01-03');

    fs.mkdirSync(completedDirectory, { recursive: true });
    fs.mkdirSync(laterDirectory, { recursive: true });
    fs.writeFileSync(path.join(completedDirectory, '123.json'), '{"order":"preserve"}');
    fs.writeFileSync(path.join(archiveDirectory, '2026-01-02.tar.gz'), 'invalid archive');
    fs.writeFileSync(path.join(laterDirectory, '456.json'), '{"order":"still archived"}');

    await assert.rejects(
        archiveCompletedOrderDays(archiveDirectory, new Date(2026, 0, 4)),
        /Unable to archive 1 completed order day/
    );

    assert.equal(fs.existsSync(path.join(completedDirectory, '123.json')), true);
    assert.equal(fs.existsSync(path.join(archiveDirectory, '2026-01-03.tar.gz')), true);
    assert.equal(fs.existsSync(laterDirectory), false);
});
