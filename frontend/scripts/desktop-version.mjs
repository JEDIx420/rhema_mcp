export function parseCargoLockPackageVersion(cargoLock, packageName) {
  const normalizedCargoLock = cargoLock.replace(/\r\n?/g, "\n");
  const packageBlocks = normalizedCargoLock.split(/^\[\[package\]\]\n/m).slice(1);

  for (const packageBlock of packageBlocks) {
    const name = packageBlock.match(/^name = "([^"]+)"$/m)?.[1];
    if (name !== packageName) continue;

    return packageBlock.match(/^version = "([^"]+)"$/m)?.[1];
  }

  return undefined;
}
