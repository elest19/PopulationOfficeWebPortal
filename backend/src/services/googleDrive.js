const { google } = require('googleapis');
const config = require('../config/env');

function getDriveClient() {
  const { clientEmail, privateKey } = config.drive || {};

  if (!clientEmail || !privateKey) {
    const err = new Error('Google Drive is not configured. Please set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.');
    err.status = 500;
    throw err;
  }

  // Handle escaped newlines in env var
  const fixedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: fixedKey,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  return google.drive({ version: 'v3', auth });
}

async function uploadFile({ buffer, mimeType, fileName, parents }) {
  const drive = getDriveClient();

  const fileMetadata = {
    name: fileName,
    parents: parents && parents.length ? parents : undefined
  };

  const media = {
    mimeType,
    body: bufferToStream(buffer)
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink',
    supportsAllDrives: true
  });

  return {
    fileId: res.data.id,
    webViewLink: res.data.webViewLink
  };
}

async function createFolder(name, parentId) {
  const drive = getDriveClient();

  const safeName = String(name || 'Task Folder').slice(0, 100);

  const res = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    },
    fields: 'id',
    supportsAllDrives: true
  });

  return res.data.id;
}

async function deleteFile(fileId) {
  if (!fileId) return;
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (err) {
    // Log and swallow; we don't want to block app logic if cleanup fails.
    console.error('Failed to delete Google Drive file:', err && err.message ? err.message : err);
  }
}

async function renameFile(fileId, newName) {
  if (!fileId) return;
  const drive = getDriveClient();

  const safeName = String(newName || 'Task Folder').slice(0, 100);

  try {
    await drive.files.update({
      fileId,
      requestBody: { name: safeName },
      supportsAllDrives: true
    });
  } catch (err) {
    // Log and swallow; renaming should not block main logic.
    console.error('Failed to rename Google Drive file:', err && err.message ? err.message : err);
  }
}

function bufferToStream(buffer) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

module.exports = {
  uploadFile,
  deleteFile,
  createFolder,
  renameFile
};
