#! /usr/bin/env node
const { readFileSync, writeFileSync, existsSync } = require('fs');
const {
  formatAst,
  parsePrismaSchema,
} = require('@loancrate/prisma-schema-parser');
const { execSync } = require('child_process');

const path = require('path');

execSync('npx prisma format', { stdio: 'inherit' });

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const history = path.join(process.cwd(), 'prisma', 'history.prisma');

const {
  deleteHistoryModels,
  createHistoryModel,
  getModels,
  getEnums,
  getHistoryfeilds,
} = require('./lib');

const ast = parsePrismaSchema(readFileSync(schemaPath, { encoding: 'utf8' }));
let historyfeilds = [];
if (existsSync(history)) {
  historyfeilds = getHistoryfeilds(
    parsePrismaSchema(readFileSync(history, { encoding: 'utf8' }))
  );
}

deleteHistoryModels(ast);
const enums = getEnums(ast);
const models = getModels(ast);

for (model of Object.values(models)) {
  createHistoryModel(ast, enums, model, historyfeilds);
}

writeFileSync(schemaPath, formatAst(ast));

execSync('npx prisma generate', { stdio: 'inherit' });
