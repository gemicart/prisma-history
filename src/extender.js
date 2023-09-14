const validOperations = ['updateMany', 'update', 'upsert', 'deleteMany', 'delete'];

async function updateManyOverride(tx, params, historyData) {
  const { model } = params;

  const entity = tx[model];
  const foundRecord = await entity.findMany({
    where: {
      ...params.args.where,
    },
  });

  // if no records found do not update history
  if (foundRecord.length === 0) {
    return { count: 0 };
  }
  const updatedEntity = await tx[model].updateMany({
    ...params.args,
    skipHistory: true,
  });

  const historyModel = model + '_History';
  const historyEntity = tx[historyModel];

  await historyEntity.createMany({
    data: foundRecord.map((item) => {
      item.HistoryOperation = 'UPDATE';
      item = { ...item, ...historyData };
      return item;
    }),
  });
  return updatedEntity;
}

async function updateOverride(tx, params, historyData) {
  const { model } = params;
  const entity = tx[model];

  const foundRecord = await entity.findUnique({
    where: {
      ...params.args.where,
    },
  });
  if (!foundRecord) {
    return;
  }
  params.args.data = {
    ...params.args.data,
  };
  const updatedRecord = await entity.update({
    ...params.args,
    skipHistory: true,
  });

  const historyModel = model + '_History';
  const historyEntity = tx[historyModel];

  await historyEntity.create({
    data: {
      ...foundRecord,
      ...historyData,
      HistoryOperation: 'UPDATE',
    },
  });
  return updatedRecord;
}

async function deleteOverride(tx, params, historyData) {
  const { model } = params;
  const entity = tx[model];

  const deletedRecord = await entity.delete({
    ...params.args,
    skipHistory: true,
  });

  const historyModel = model + '_History';
  const historyEntity = tx[historyModel];

  await historyEntity.create({
    data: {
      ...deletedRecord,
      ...historyData,
      HistoryOperation: 'DELETE',
    },
  });
  return deletedRecord;
}

async function upsertOverride(tx, params, historyData) {
  const { model, args } = params;
  const entity = tx[model];

  console.log('upsertOverride', args);

  const foundRecord = await entity.findUnique({
    where: {
      ...args.where,
    },
  });

  let upsertedResource;
  if (!foundRecord) {
    // if not found create new record
    upsertedResource = await entity.create({
      data: params.args.create,
    });
  } else {
    // if found update record and create history record
    upsertedResource = await entity.update({
      where: params.args.where,
      data: params.args.update,
      skipHistory: true,
    });

    const historyModel = model + '_History';
    const historyEntity = tx[historyModel];

    await historyEntity.create({
      data: {
        ...foundRecord,
        ...historyData,
        HistoryOperation: 'UPDATE',
      },
    });
  }
  return upsertedResource;
}

async function deleteManyOverride(tx, params, historyData) {
  const { model } = params;
  const entity = tx[model];

  const foundResource = await entity.findMany({
    where: {
      ...params.args.where,
    },
  });
  if (foundResource.length === 0) {
    return { count: 0 };
  }
  const deletedResource = await entity.deleteMany({
    ...params.args,
    skipHistory: true,
  });

  const historyModel = model + '_History';
  const historyEntity = tx[historyModel];

  await historyEntity.createMany({
    data: foundResource.map((item) => {
      item = { ...item, ...historyData, HistoryOperation: 'DELETE' };
      return item;
    }),
  });
  return deletedResource;
}

const operationOverrideMap = {
  updateMany: updateManyOverride,
  update: updateOverride,
  upsert: upsertOverride,
  deleteMany: deleteManyOverride,
  delete: deleteOverride,
};

function extender(prisma, checkfn) {
  const extendedPrisma = prisma.$extends({
    query: {
      async $allOperations(params) {
        const { model, operation, args, query } = params;

        if (checkfn && !args?.skipHistory) {
          await checkfn({ model, operation, args, query });
        }

        let historyData = {};

        if (args.history) {
          historyData = args.history;
          delete args.history;
        }

        if (!validOperations.includes(operation) || args?.skipHistory) {
          if (args?.skipHistory) {
            delete args.skipHistory;
          }
          return await query(args);
        }

        const modelName = model.charAt(0).toLowerCase() + model.slice(1);
        const modifiedParams = {
          model: modelName,
          operation,
          args,
          query,
        };

        const overrideFn = operationOverrideMap[operation];

        // if transaction is available, use it
        if (extendedPrisma.$transaction) {
          return await extendedPrisma.$transaction((tx) => overrideFn(tx, modifiedParams, historyData));
        } else {
          return await overrideFn(extendedPrisma, modifiedParams, historyData);
        }
      },
    },
  });

  return extendedPrisma;
}

module.exports = extender;
