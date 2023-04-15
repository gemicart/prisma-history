const actions = ['update', 'delete', 'upsert', 'deleteMany', 'updateMany'];

const middleware = (prisma) => {
  return async (params, next) => {
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
    switch (params.action) {
      case 'update':
        return await prisma.$transaction(async (tx) => {
          const result = await tx[modelName].findUnique({
            where: {
              ...params.args.where,
            },
          });
          if (!result) {
            return;
          }
          const result2 = await tx[modelName].update({
            ...params.args,
            skipHistory: true,
          });
          await tx[modelHistoryName].create({
            data: {
              ...result,
            },
          });
          return result2;
        });
        break;
      case 'delete':
        return await prisma.$transaction(async (tx) => {
          const result = await tx[modelName].delete({
            ...params.args,
            skipHistory: true,
          });
          await tx[modelHistoryName].create({
            data: {
              ...result,
            },
          });
          return result;
        });
        break;
      case 'upsert':
        return await prisma.$transaction(async (tx) => {
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
          await tx[modelHistoryName].create({
            data: {
              ...result,
            },
          });
          return result2;
        });
        break;
      case 'deleteMany':
        return await prisma.$transaction(async (tx) => {
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
            data: result,
          });
          return result2;
        });
        break;
      case 'updateMany':
        return await prisma.$transaction(async (tx) => {
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
            data: result,
          });
          return result2;
        });
        break;
    }
  };
};

module.exports = middleware;
