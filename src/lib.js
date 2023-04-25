const prismaMainTypes = {
  String: 'String',
  Boolean: 'Boolean',
  Int: 'Int',
  BigInt: 'BigInt',
  Float: 'Float',
  Decimal: 'Decimal',
  DateTime: 'DateTime',
  Bytes: 'Bytes',
  Json: 'Json',
};

const attrToRemove = {
  id: 'id',
  default: 'default',
  unique: 'unique',
};

const getMemberType = (member) => {
  if (member.type.kind === 'typeId') {
    return member.type.name.value;
  }
  return getMemberType(member.type);
};

const SetMemberTypeString = (member) => {
  if (member.type.kind === 'typeId') {
    member.type.name.value = 'String';
  } else {
    SetMemberTypeString(member.type);
  }
};

const fixAttributes = (attrs) => {
  for (attrIndex in attrs) {
    const attr = attrs[attrIndex];
    if (attrToRemove[attr.path.value[0]]) {
      delete attrs[attrIndex];
    }
  }
};

const getEnums = (ast) => {
  const enums = {};

  for (decIndex in ast.declarations) {
    const dec = ast.declarations[decIndex];
    if (dec.kind === 'enum') {
      enums[dec.name.value] = dec.name.value;
    }
  }
  return enums;
};

const deleteHistoryModels = (ast) => {
  for (decIndex in ast.declarations) {
    const dec = ast.declarations[decIndex];
    if (dec.kind === 'model' && dec.name.value.endsWith('_History')) {
      delete ast.declarations[decIndex];
    }
  }
};

const getHistoryfeilds = (ast) => {
  const models = getModels(ast);
  if (!models.History) {
    return [];
  }
  return ast.declarations[models.History.index].members;
};

const createHistoryModel = (ast, enums, model, historyfeilds) => {
  const copyModel = JSON.parse(JSON.stringify(ast.declarations[model.index]));
  copyModel.name.value = copyModel.name.value + '_History';
  for (memberIndex in copyModel.members) {
    const member = copyModel.members[memberIndex];
    if (member.kind !== 'field') {
      delete copyModel.members[memberIndex];
      continue;
    }
    const memberType = getMemberType(member);
    if (enums[memberType]) {
      SetMemberTypeString(member);
    }
    if (!prismaMainTypes[memberType]) {
      if (!enums[memberType]) {
        delete copyModel.members[memberIndex];
        continue;
      }
    }
    if (member.type.kind !== 'optional' && member.type.kind !== 'list') {
      const newType = {
        kind: 'optional',
        type: { ...member.type },
      };
      member.type = newType;
    }
    fixAttributes(member.attributes);
  }

  copyModel.members.push({
    kind: 'field',
    name: { kind: 'name', value: 'HistoryCreatedDate' },
    type: { kind: 'typeId', name: { kind: 'name', value: 'DateTime' } },
    attributes: [
      {
        kind: 'fieldAttribute',
        path: { kind: 'path', value: ['default'] },
        args: [
          {
            kind: 'functionCall',
            path: { kind: 'path', value: ['now'] },
            args: [],
          },
        ],
      },
    ],
    comment: null,
  });

  copyModel.members.push({
    kind: 'field',
    name: { kind: 'name', value: 'HistoryId' },
    type: { kind: 'typeId', name: { kind: 'name', value: 'String' } },
    attributes: [
      {
        kind: 'fieldAttribute',
        path: { kind: 'path', value: ['id'] },
        args: [],
      },
      {
        kind: 'fieldAttribute',
        path: { kind: 'path', value: ['default'] },
        args: [
          {
            kind: 'functionCall',
            path: { kind: 'path', value: ['uuid'] },
            args: [],
          },
        ],
      },
    ],
    comment: null,
  });

  copyModel.members.push({
    kind: 'field',
    name: { kind: 'name', value: 'HistoryOperation' },
    type: { kind: 'typeId', name: { kind: 'name', value: 'String' } },
  });

  historyfeilds.map((field) => {
    copyModel.members.push(field);
  });

  ast.declarations.push(copyModel);
};

const getModels = (ast) => {
  const modals = {};

  for (decIndex in ast.declarations) {
    const dec = ast.declarations[decIndex];
    if (dec.kind === 'model') {
      modals[dec.name.value] = { index: decIndex };
    }
  }
  return modals;
};

module.exports = {
  fixAttributes,
  getMemberType,
  getModels,
  getEnums,
  deleteHistoryModels,
  createHistoryModel,
  getHistoryfeilds,
};
