const { Prisma } = require('@prisma/client');

const updateOverride = async (tx, model, args, historyData) => {
  const find = await tx[model].findUnique({ where: args.where });

  await tx[`${model}_History`].create({
    data: {
      ...find,
      ...historyData,
      HistoryOperation: 'UPDATE',
    },
  });

  return await tx[model].update(args);
};

const updateManyOverride = async (tx, model, args, historyData) => {
  const find = await tx[model].findMany({ where: args.where });

  if (find.length === 0) {
    return { count: 0 };
  }

  await tx[`${model}_History`].createMany({
    data: find.map((item) => {
      return { ...item, HistoryOperation: 'UPDATE', ...historyData };
    }),
  });

  return await tx[model].updateMany(args);
};

const deleteOverride = async (tx, model, args, historyData) => {
  const find = await tx[model].findUnique({ where: args.where });

  await tx[`${model}_History`].create({
    data: {
      ...find,
      ...historyData,
      HistoryOperation: 'DELETE',
    },
  });

  return await tx[model].delete(args);
};

const deleteManyOverride = async (tx, model, args, historyData) => {
  const find = await tx[model].findMany({ where: args.where });

  if (find.length === 0) {
    return { count: 0 };
  }

  await tx[`${model}_History`].createMany({
    data: find.map((item) => {
      return { ...item, HistoryOperation: 'DELETE', ...historyData };
    }),
  });

  return await tx[model].deleteMany(args);
};

const upsertOverride = async (tx, model, args, historyData) => {
  const find = await tx[model].findUnique({ where: args.where });

  if (!find) {
    return tx[model].create({
      data: args.create,
    });
  } else {
    await tx[`${model}_History`].create({
      data: {
        ...find,
        ...historyData,
        HistoryOperation: 'UPDATE',
      },
    });
    return await tx[model].update({
      where: args.where,
      data: args.update,
    });
  }
};

const operations = {
  update: updateOverride,
  updateMany: updateManyOverride,
  delete: deleteOverride,
  deleteMany: deleteManyOverride,
  upsert: upsertOverride,
};

const handleOperation = async (context, model, args, operation) => {
  const historyData = args.history || {};
  if (args.history) {
    delete args.history;
  }

  if (context.$parent.$transaction) {
    return context.$parent.$transaction(async (tx) => {
      return operations[operation](tx, model, args, historyData);
    });
  } else {
    return operations[operation](context.$parent, model, args, historyData);
  }
};

function extender(prisma, checkfn) {
  return prisma.$extends({
    model: {
      $allModels: {
        async update(args) {
          const context = Prisma.getExtensionContext(this);
          const model = context.$name;
          if (checkfn) {
            await checkfn({ model, operation: 'update', args, context });
          }

          return handleOperation(context, model, args, 'update');
        },
        async updateMany(args) {
          const context = Prisma.getExtensionContext(this);
          const model = context.$name;
          if (checkfn) {
            await checkfn({ model, operation: 'updateMany', args, context });
          }

          return handleOperation(context, model, args, 'updateMany');
        },
        async delete(args) {
          const context = Prisma.getExtensionContext(this);
          const model = context.$name;
          if (checkfn) {
            await checkfn({ model, operation: 'delete', args, context });
          }

          return handleOperation(context, model, args, 'delete');
        },
        async deleteMany(args) {
          const context = Prisma.getExtensionContext(this);
          const model = context.$name;
          if (checkfn) {
            await checkfn({ model, operation: 'deleteMany', args, context });
          }

          return handleOperation(context, model, args, 'deleteMany');
        },
        async upsert(args) {
          const context = Prisma.getExtensionContext(this);
          const model = context.$name;
          if (checkfn) {
            await checkfn({ model, operation: 'upsert', args, context });
          }

          return handleOperation(context, model, args, 'upsert');
        },
      },
    },
  });
}

module.exports = extender;
