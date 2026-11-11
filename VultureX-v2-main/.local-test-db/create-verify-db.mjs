import { localDatabaseUrl } from "./config.mjs";
import postgres from "postgres";

const admin = postgres(localDatabaseUrl(), {
  max: 1,
  prepare: false,
  onnotice: () => {},
});

await admin`drop database if exists vulturex_verify`;
await admin`create database vulturex_verify`;
console.log("created disposable database vulturex_verify");
await admin.end({ timeout: 2 });
