Add-Type -AssemblyName System.Drawing

$targetW = 1242
$targetH = 2688
$outDir = "C:\Users\Yours Truly\OneDrive\Documents\Chris\Projects\sticker-quest-ios\screenshots"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$files = @(
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_149---4cc79374-8741-4e58-912c-e648ec7f5486.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_150---4077000c-1b08-4fe7-b435-dfec11f8f22d.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_151---26680326-1a82-45ba-86c7-497c7c566680.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_152---d9ce9da3-cc9d-4b86-97b4-23263e2ccc2d.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_153---e3ca5b59-14de-4c6a-9d25-969687ebb9a2.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_154---903df722-8771-4504-a6eb-eabcded4c0b0.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_155---556c67a7-3dd8-4ee5-b053-a118d7ae33db.jpg",
  "C:\Users\Yours Truly\.openclaw\media\inbound\file_156---ad2f15a5-e6b8-4aa6-9434-0b3a6d22b4e7.jpg"
)

$names = @("01-today-quests", "02-manage-rewards", "03-manage-quests", "04-reward-store", "05-parent-dashboard", "06-login", "07-sticker-book", "08-daily-goal")

for ($i = 0; $i -lt $files.Count; $i++) {
  $src = [System.Drawing.Image]::FromFile($files[$i])
  
  # Create target image with pink background
  $dst = New-Object System.Drawing.Bitmap($targetW, $targetH)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  
  # Fill with app's pink background color
  $g.Clear([System.Drawing.Color]::FromArgb(255, 255, 200, 220))
  
  # Scale to fill width, center vertically
  $scale = $targetW / $src.Width
  $newH = [int]($src.Height * $scale)
  $y = [int](($targetH - $newH) / 2)
  
  $g.DrawImage($src, 0, $y, $targetW, $newH)
  
  $outPath = Join-Path $outDir "$($names[$i]).png"
  $dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  
  Write-Host "✅ $($names[$i]).png - ${targetW}x${targetH}"
  
  $g.Dispose()
  $dst.Dispose()
  $src.Dispose()
}

Write-Host "`nAll screenshots resized to ${targetW}x${targetH}"
