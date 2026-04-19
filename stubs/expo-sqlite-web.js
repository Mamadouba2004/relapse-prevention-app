// Web stub for expo-sqlite — all functions are no-ops since Platform guards prevent any SQLite usage on web

const noopAsync = () => Promise.resolve(null);
const noopListAsync = () => Promise.resolve([]);

const stubbedDatabase = {
  execAsync: noopAsync,
  runAsync: noopAsync,
  getAllAsync: noopListAsync,
  getFirstAsync: noopAsync,
  closeAsync: noopAsync,
  withTransactionAsync: noopAsync,
  withExclusiveTransactionAsync: noopAsync,
};

export const openDatabaseAsync = () => Promise.resolve(stubbedDatabase);
export const openDatabaseSync = () => stubbedDatabase;
export const deleteDatabaseAsync = noopAsync;
export const deleteDatabaseSync = () => {};
export const addDatabaseChangeListener = () => ({ remove: () => {} });

export class SQLiteDatabase {}
export class SQLiteStatement {}
export class SQLiteSession {}

export default {
  openDatabaseAsync,
  openDatabaseSync,
  deleteDatabaseAsync,
  deleteDatabaseSync,
  addDatabaseChangeListener,
};
