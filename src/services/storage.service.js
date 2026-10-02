const { ImageKit } = require("@imagekit/nodejs");
const logger = require("../utils/logger");

let imageKitClient = null;

function getClient() {
  if (!imageKitClient) {
    imageKitClient = new ImageKit({
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "dummy_pk",
    });
  }
  return imageKitClient;
}

/**
 * Uploads a base64 or buffer file to ImageKit
 * @param {string|Buffer} file
 * @param {{ folder?: string, fileNamePrefix?: string }} options
 */
async function uploadFile(file, { folder = "music", fileNamePrefix = "music" } = {}) {
  const client = getClient();
  const result = await client.files.upload({
    file,
    fileName: `${fileNamePrefix}_${Date.now()}`,
    folder,
  });

  return result;
}

/**
 * Deletes a file from ImageKit by fileId
 * @param {string} fileId
 */
async function deleteFile(fileId) {
  if (!fileId) return;
  try {
    const client = getClient();
    await client.files.deleteFile(fileId);
    logger.info(`Deleted file from ImageKit: ${fileId}`);
  } catch (error) {
    logger.error(`Error deleting file ${fileId} from ImageKit:`, error);
  }
}

module.exports = { uploadFile, deleteFile };
