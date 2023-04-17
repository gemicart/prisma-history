const actions = ['update', 'delete', 'upsert', 'deleteMany', 'updateMany'];

const update_fn = async ({ tx, modelName, params, historyData }) => {
  const modelHistoryName = modelName + '_History';

  const result = await tx[modelName].findUnique({
    where: {
      ...params.args.where,
    },
  });
  if (!result) {
    return;
  }
  params.args.data = {
    ...params.args.data,
  };
  const result2 = await tx[modelName].update({
    ...params.args,
    skipHistory: true,
  });
  await tx[modelHistoryName].create({
    data: {
      ...result,
      ...historyData,
      HistoryOperation: 'UPDATE',
    },
  });
  return result2;
};

const delete_fn = async ({ tx, modelName, params, historyData }) => {
  const result = await tx[modelName].delete({
    ...params.args,
    skipHistory: true,
  });
  result.HistoryOperation = 'DELETE';
  await tx[modelHistoryName].create({
    data: {
      ...result,
      ...historyData,
    },
  });
  return result;
};

const upsert_fn = async ({ tx, modelName, params, historyData }) => {
  const result = await tx[modelName].findUnique({
    where: {
      ...params.args.where,
    },
  });
  let result2;
  if (!result) {
    result2 = await tx[modelName].create({
      data: params.args.create,
    });
  } else {
    result2 = await tx[modelName].update({
      where: params.args.where,
      data: params.args.update,
      skipHistory: true,
    });
  }
  if (!result2) {
    result2.HistoryOperation = 'UPDATE';
    await tx[modelHistoryName].create({
      data: {
        ...result,
        ...historyData,
      },
    });
  }
  return result2;
};

const deleteMany_fn = async ({ tx, modelName, params, historyData }) => {
  const result = await tx[modelName].findMany({
    where: {
      ...params.args.where,
    },
  });
  if (result.length === 0) {
    return { count: 0 };
  }
  const result2 = await tx[modelName].deleteMany({
    ...params.args,
    skipHistory: true,
  });
  await tx[modelHistoryName].createMany({
    data: result.map((item) => {
      item.HistoryOperation = 'DELETE';
      item = { ...item, ...historyData };
      return item;
    }),
  });
  return result2;
};

const updateMany_fn = async ({ tx, modelName, params, historyData }) => {
  const result = await tx[modelName].findMany({
    where: {
      ...params.args.where,
    },
  });
  if (result.length === 0) {
    return { count: 0 };
  }
  const result2 = await tx[modelName].updateMany({
    ...params.args,
    skipHistory: true,
  });
  await tx[modelHistoryName].createMany({
    data: result.map((item) => {
      item.HistoryOperation = 'UPDATE';
      item = { ...item, ...historyData };
      return item;
    }),
  });
  return result2;
};

const fnlist = {
  update: update_fn,
  delete: delete_fn,
  upsert: upsert_fn,
  deleteMany: deleteMany_fn,
  updateMany: updateMany_fn,
};

const middleware = (checkfn) => {
  return (prisma) => {
    return async (params, next) => {
      if (checkfn) {
        await checkfn(params);
      }
      let historyData = {};
      if (params.history) {
        historyData = params.history;
      }
      delete params.history;
      if (!actions.includes(params.action) || params?.args?.skipHistory) {
        if (params?.args?.skipHistory) {
          delete params.args.skipHistory;
        }
        const result = await next(params);
        return result;
      }
      const modelName =
        params.model.charAt(0).toLowerCase() + params.model.slice(1);
      const modelHistoryName = modelName + '_History';

      if (prisma.$transaction) {
        return await prisma.$transaction((tx) =>
          fnlist[params.action]({ tx, modelName, params, historyData })
        );
      } else {
        return await fnlist[params.action]({
          tx: prisma,
          modelName,
          params,
          historyData,
        });
      }
    };
  };
};

module.exports = middleware;
