const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

async function initDB() {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            title TEXT,
            is_active INTEGER DEFAULT 0
        );
    `);
}

async function getSetting(key) {
    const result = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
}

async function setSetting(key, value) {
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

async function getGroups() {
    return await db.all('SELECT * FROM groups');
}

async function getActiveGroups() {
    const groups = await db.all('SELECT id FROM groups WHERE is_active = 1');
    return groups.map(g => g.id);
}

async function addOrUpdateGroup(id, title, isActive) {
    const existing = await db.get('SELECT * FROM groups WHERE id = ?', [id]);
    if (existing) {
        if (isActive !== undefined) {
            await db.run('UPDATE groups SET title = ?, is_active = ? WHERE id = ?', [title, isActive ? 1 : 0, id]);
        } else {
            await db.run('UPDATE groups SET title = ? WHERE id = ?', [title, id]);
        }
    } else {
        await db.run('INSERT INTO groups (id, title, is_active) VALUES (?, ?, ?)', [id, title, isActive ? 1 : 0]);
    }
}

async function toggleGroup(id) {
    const group = await db.get('SELECT is_active FROM groups WHERE id = ?', [id]);
    if (group) {
        const newState = group.is_active ? 0 : 1;
        await db.run('UPDATE groups SET is_active = ? WHERE id = ?', [newState, id]);
        return newState;
    }
    return null;
}

module.exports = {
    initDB,
    getSetting,
    setSetting,
    getGroups,
    getActiveGroups,
    addOrUpdateGroup,
    toggleGroup
};
