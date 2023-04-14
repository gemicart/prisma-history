#! /usr/bin/env node
const { readFileSync, writeFileSync } = require('fs');
const {
  formatAst,
  parsePrismaSchema,
} = require('@loancrate/prisma-schema-parser');

const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

const {
  deleteHistoryModels,
  createHistoryModel,
  getModels,
  getEnums,
} = require('./lib');
const { execSync } = require('child_process');

const ast = parsePrismaSchema(readFileSync(schemaPath, { encoding: 'utf8' }));

deleteHistoryModels(ast);
const enums = getEnums(ast);
const models = getModels(ast);

for (model of Object.values(models)) {
  createHistoryModel(ast, enums, model);
}

writeFileSync(schemaPath, formatAst(ast));

execSync('npx prisma format', { stdio: 'inherit' });
execSync('npx prisma generate', { stdio: 'inherit' });
