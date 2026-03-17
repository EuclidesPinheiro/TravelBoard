const XLSX = require('xlsx');
const workbook = XLSX.readFile('Viagem_plan.xlsx');
const result = {};
workbook.SheetNames.forEach(sheetName => {
  const roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: "yyyy-mm-dd" });
  if (roa.length) result[sheetName] = roa;
});
console.log(JSON.stringify(result, null, 2));
