const fs = require('fs');
const file = 'src/application/useCases/DispatchStock.ts';
let code = fs.readFileSync(file, 'utf8');

const target1 = `          const costRepo = this.costLayerRepository;
          if (costRepo.saveMany) {
            await costRepo.saveMany(activeLayers);
          } else {
            await Promise.all(activeLayers.map((l) => costRepo.save(l)));
          }`;

const replacement1 = `          const costRepo = this.costLayerRepository;
          const modifiedLayers = targetLayers.filter(l => l.remainingQuantity < l.originalQuantity);
          if (modifiedLayers.length > 0) {
            if (costRepo.saveMany) {
              await costRepo.saveMany(modifiedLayers);
            } else {
              await Promise.all(modifiedLayers.map((l) => costRepo.save(l)));
            }
          }`;

code = code.replace(target1, replacement1);

fs.writeFileSync(file, code);
