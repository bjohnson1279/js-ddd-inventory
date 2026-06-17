const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/infrastructure/http/controllers/**/*.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // We want to replace `error: error.message, type: error.name` inside `if (error instanceof DomainException)`
  // Wait, if it is inside `error instanceof DomainException`, then it IS a DomainException.
  // We verified earlier:
  //      if (error instanceof DomainException) {
  //        res.status(400).json({ error: error.message, type: error.name });
  //      } else {
  //        console.error(error);
  //        res.status(500).json({ error: "Internal server error" });
  //      }

  // So this is SECURE.
});
