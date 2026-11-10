import postgres from "postgres";

const admin = postgres("postgres://postgres:postgres@127.0.0.1:55432/postgres", {
  max: 1,
  prepare: false,
  onnotice: () => {},
});

await admin`drop database if exists vulturex_verify`;
await admin`create database vulturex_verify`;
console.log("created disposable database vulturex_verify");
await admin.end({ timeout: 2 });
