/**
 * A group of functions for storing recordings on the file system.
 * Functions are asynchronous to unload the server from heavy file system operations.
 */
import fs from 'fs';
import * as path from "path";

/**
 * Reads a file from path and returns its content as a string.
 * @param path The path to the file.
 * @returns {Promise<string>}
 * @category WorkflowManagement-Storage
 */
export const readFile = (path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/**
 * Writes a string to a file. If the file already exists, it is overwritten.
 * @param path The path to the file.
 * @param data The data to write to the file.
 * @returns {Promise<void>}
 * @category WorkflowManagement-Storage
 */
export const saveFile = (path: string, data: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Deletes a file from the file system.
 * @param path The path to the file.
 * @returns {Promise<void>}
 * @category WorkflowManagement-Storage
 */
export const deleteFile = (path: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Reads all files from a directory and returns an array of their contents.
 * @param dirname The path to the directory.
 * @category WorkflowManagement-Storage
 * @returns {Promise<string[]>}
 */
export const readFiles = (dirname: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    fs.readdir(dirname, (err, filenames) => {
      if (err) return reject(err);
      const names = filenames.filter((filename) => !filename.startsWith('.'));
      Promise.all(
        names.map(
          (filename) =>
            new Promise<string>((res, rej) => {
              fs.readFile(path.resolve(dirname, filename), 'utf-8', (readErr, content) => {
                if (readErr) rej(readErr);
                else res(content);
              });
            })
        )
      )
        .then(resolve)
        .catch(reject);
    });
  });
};



