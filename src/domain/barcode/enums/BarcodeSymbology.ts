export enum BarcodeSymbology {
  UPC_A = 'upc_a',
  UPC_E = 'upc_e',
  EAN_13 = 'ean_13',
  EAN_8 = 'ean_8',
  CODE_128 = 'code_128',
  QR = 'qr',
  ITF_14 = 'itf_14',
  GS1_128 = 'gs1_128',
}

export function getBarcodeSymbologyLabel(symbology: BarcodeSymbology): string {
  switch (symbology) {
    case BarcodeSymbology.UPC_A:
      return 'UPC-A';
    case BarcodeSymbology.UPC_E:
      return 'UPC-E';
    case BarcodeSymbology.EAN_13:
      return 'EAN-13';
    case BarcodeSymbology.EAN_8:
      return 'EAN-8';
    case BarcodeSymbology.CODE_128:
      return 'Code 128';
    case BarcodeSymbology.QR:
      return 'QR Code';
    case BarcodeSymbology.ITF_14:
      return 'ITF-14';
    case BarcodeSymbology.GS1_128:
      return 'GS1-128';
    default:
      return symbology;
  }
}
