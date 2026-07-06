const fs = require('fs');
const file = 'src/domain/accounting/services/CostLayerService.ts';
let code = fs.readFileSync(file, 'utf8');

const target1 = `    if (this.layers.saveMany) {
      await this.layers.saveMany(activeLayers);
    } else {
      await Promise.all(
        activeLayers.map((layer) => this.layers.save(layer))
      );
    }`;

const replacement1 = `    const modifiedLayers = activeLayers.filter(l => l.remainingQuantity < l.originalQuantity);
    if (modifiedLayers.length > 0) {
      if (this.layers.saveMany) {
        await this.layers.saveMany(modifiedLayers);
      } else {
        await Promise.all(
          modifiedLayers.map((layer) => this.layers.save(layer))
        );
      }
    }`;

code = code.replace(target1, replacement1);

fs.writeFileSync(file, code);
