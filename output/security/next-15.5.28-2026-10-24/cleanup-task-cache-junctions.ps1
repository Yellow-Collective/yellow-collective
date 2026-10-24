# Run in a normal PowerShell outside the Codex filesystem sandbox.
# Removes only the 37 junctions created during this update; never their targets.
$ErrorActionPreference = 'Stop'
$cacheRoot = 'C:\Users\Deej\AppData\Local\Yarn\Cache\v6'
$expectedTargetRoot = 'D:\CodexTemp\yellow-next-security-20261024-01a16e23'
$names = @(
  'npm-@img-sharp-darwin-arm64-0.35.5-b1e0276d4e9bf26a7fde7b2adcbe076c71015fc2-integrity'
  'npm-@img-sharp-darwin-x64-0.35.5-bff811f9610ef322415e87f7551fd5d773122928-integrity'
  'npm-@img-sharp-freebsd-wasm32-0.35.5-53b6041958608afa2f5f08323091101407e99086-integrity'
  'npm-@img-sharp-libvips-darwin-arm64-1.3.4-f29cbba302384f9a08bdb04d14c57b5cf71da4a4-integrity'
  'npm-@img-sharp-libvips-darwin-x64-1.3.4-527f52721a89dd75614663aef87162a781739bab-integrity'
  'npm-@img-sharp-libvips-linux-arm-1.3.4-f5ecd8ebb63690e580438e308ce73015b49516a8-integrity'
  'npm-@img-sharp-libvips-linux-arm64-1.3.4-78c11c6b0a4b4045c72dacacdec3b10f3e521349-integrity'
  'npm-@img-sharp-libvips-linux-ppc64-1.3.4-b66a4d25bd042eff66c8076b1e4bd99c6d19246e-integrity'
  'npm-@img-sharp-libvips-linux-riscv64-1.3.4-9dee8b3fd801c0ff5d6083d6558d3c89b8dedc1b-integrity'
  'npm-@img-sharp-libvips-linux-s390x-1.3.4-55a80f118f9ffd7653d20cefde41fca6ba0241e2-integrity'
  'npm-@img-sharp-libvips-linux-x64-1.3.4-a0de3840ae386476eb4045d6d2b056a8062c548b-integrity'
  'npm-@img-sharp-libvips-linuxmusl-arm64-1.3.4-420f2418eaec33cef4346e43d96a7864bb3fcbb4-integrity'
  'npm-@img-sharp-libvips-linuxmusl-x64-1.3.4-eb5696f7fa521f5f7f3d962fd9ade41deeba6a51-integrity'
  'npm-@img-sharp-linux-arm-0.35.5-950645b8695c200bfdb3c6eccf17c32c26968c23-integrity'
  'npm-@img-sharp-linux-arm64-0.35.5-ffaea1b88310b5bc40de48859a7f8f01d07e5e99-integrity'
  'npm-@img-sharp-linux-ppc64-0.35.5-af60c7db090411f7af2df2bc1aa764b93b6b8add-integrity'
  'npm-@img-sharp-linux-riscv64-0.35.5-afcd42ac0592330fbf4fff5904574e0e049ba0a4-integrity'
  'npm-@img-sharp-linux-s390x-0.35.5-092e584a8f36f2f90ba98652d6f45432edea87cb-integrity'
  'npm-@img-sharp-linux-x64-0.35.5-f624f6b98c6579084b9fb363d7cb83e2315de79c-integrity'
  'npm-@img-sharp-linuxmusl-arm64-0.35.5-92d0904211086d10bd3c929de715dd8a81fa7268-integrity'
  'npm-@img-sharp-linuxmusl-x64-0.35.5-1d146eab6dfcdc6429f29b032b8bc3f0180b6d80-integrity'
  'npm-@img-sharp-wasm32-0.35.5-5369559c3a4c32e08ce92b6ffba2434175a45a62-integrity'
  'npm-@img-sharp-webcontainers-wasm32-0.35.5-3674eddf41eb85d0e92896d7da01ca00310256b9-integrity'
  'npm-@img-sharp-win32-arm64-0.35.5-e3c94326eb0a46ade843b84cf50a3917b79d323f-integrity'
  'npm-@img-sharp-win32-ia32-0.35.5-cc5dac453dc3500aac2e63f182b952af0d437bc1-integrity'
  'npm-@img-sharp-win32-x64-0.35.5-1785356b8cb396e58430e03865281280acb818b1-integrity'
  'npm-@next-env-15.5.28-baeca1a42e756f461b676ff7efdb0bc9d6f6de44-integrity'
  'npm-@next-swc-darwin-arm64-15.5.28-e1305f3c10199e950bb95b07cc426f29298d050d-integrity'
  'npm-@next-swc-darwin-x64-15.5.28-f27a036f96c6b92d628779e2f563c112e3c17a75-integrity'
  'npm-@next-swc-linux-arm64-gnu-15.5.28-268ab89d9413551796be6ae46138157b684dd9f4-integrity'
  'npm-@next-swc-linux-arm64-musl-15.5.28-f12446fd30140e3b3fbe2fec16af34b6be98c62d-integrity'
  'npm-@next-swc-linux-x64-gnu-15.5.28-d444703621a68461d0a74515951be9b05a209ce5-integrity'
  'npm-@next-swc-linux-x64-musl-15.5.28-058ea33f8156cdb0dda1cd114ef879a4d933c29f-integrity'
  'npm-@next-swc-win32-arm64-msvc-15.5.28-aa695e94922faf09ac6cbd480d2dc870bf807d4a-integrity'
  'npm-@next-swc-win32-x64-msvc-15.5.28-6f56363b38ad8cb76ab9421125a5f3afc2b92d65-integrity'
  'npm-next-15.5.28-0589d32fa30ba712e4647deebeaabaf936e8a272-integrity'
  'npm-sharp-0.35.5-43fb539872ec5f53cc7162eb850dbf6514692fbf-integrity'
)
$removed = 0
foreach ($name in $names) {
  $link = [IO.Path]::GetFullPath((Join-Path $cacheRoot $name))
  if (-not $link.StartsWith($cacheRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected cache path' }
  $item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
  if (-not $item) { continue }
  if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Refusing to remove a regular directory: $link" }
  $expected = [IO.Path]::GetFullPath((Join-Path $expectedTargetRoot $name))
  if (@($item.Target).Count -ne 1 -or [IO.Path]::GetFullPath([string](@($item.Target)[0])) -ine $expected) { throw "Unexpected junction target: $link" }
  [IO.Directory]::Delete($link)
  $removed++
}
Write-Output "Removed $removed task-created junctions. Package files and other caches were preserved."
