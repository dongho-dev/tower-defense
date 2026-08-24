param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

if ($PSVersionTable.PSEdition -eq "Core") {
  $windowsPowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -InputPath $InputPath -OutputPath $OutputPath
  exit $LASTEXITCODE
}

Add-Type -AssemblyName System.Drawing
$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location

if (-not ("TowerDefense.AlphaMatte" -as [type])) {
  Add-Type -ReferencedAssemblies $drawingAssembly -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace TowerDefense
{
    public static class AlphaMatte
    {
        private static bool IsBackdrop(byte blue, byte green, byte red)
        {
            int min = Math.Min(red, Math.Min(green, blue));
            int max = Math.Max(red, Math.Max(green, blue));
            return min >= 226 && max - min <= 24;
        }

        private static bool IsInteriorBackdrop(byte blue, byte green, byte red)
        {
            int min = Math.Min(red, Math.Min(green, blue));
            int max = Math.Max(red, Math.Max(green, blue));
            return min >= 242 && max - min <= 14;
        }

        public static void Remove(string inputPath, string outputPath)
        {
            using (var source = new Bitmap(inputPath))
            using (var image = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
            {
                using (var graphics = Graphics.FromImage(image))
                {
                    graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                    graphics.DrawImageUnscaled(source, 0, 0);
                }

                var bounds = new Rectangle(0, 0, image.Width, image.Height);
                var data = image.LockBits(bounds, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                int stride = Math.Abs(data.Stride);
                var pixels = new byte[stride * image.Height];
                Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

                int width = image.Width;
                int height = image.Height;
                var backdrop = new bool[width * height];
                var queued = new bool[width * height];
                var queue = new Queue<int>();

                Action<int, int> enqueue = (x, y) =>
                {
                    int index = y * width + x;
                    if (queued[index]) return;
                    int offset = y * stride + x * 4;
                    if (!IsBackdrop(pixels[offset], pixels[offset + 1], pixels[offset + 2])) return;
                    queued[index] = true;
                    queue.Enqueue(index);
                };

                for (int x = 0; x < width; x++)
                {
                    enqueue(x, 0);
                    enqueue(x, height - 1);
                }
                for (int y = 1; y < height - 1; y++)
                {
                    enqueue(0, y);
                    enqueue(width - 1, y);
                }

                while (queue.Count > 0)
                {
                    int index = queue.Dequeue();
                    backdrop[index] = true;
                    int x = index % width;
                    int y = index / width;
                    if (x > 0) enqueue(x - 1, y);
                    if (x + 1 < width) enqueue(x + 1, y);
                    if (y > 0) enqueue(x, y - 1);
                    if (y + 1 < height) enqueue(x, y + 1);
                }

                var inspected = new bool[width * height];
                for (int index = 0; index < inspected.Length; index++)
                {
                    if (backdrop[index]) inspected[index] = true;
                }

                for (int y = 0; y < height; y++)
                {
                    for (int x = 0; x < width; x++)
                    {
                        int start = y * width + x;
                        if (inspected[start]) continue;
                        int startOffset = y * stride + x * 4;
                        if (!IsInteriorBackdrop(pixels[startOffset], pixels[startOffset + 1], pixels[startOffset + 2]))
                        {
                            inspected[start] = true;
                            continue;
                        }

                        var component = new List<int>();
                        var componentQueue = new Queue<int>();
                        inspected[start] = true;
                        componentQueue.Enqueue(start);
                        while (componentQueue.Count > 0)
                        {
                            int current = componentQueue.Dequeue();
                            component.Add(current);
                            int currentX = current % width;
                            int currentY = current / width;
                            int[] neighbors = {
                                currentX > 0 ? current - 1 : -1,
                                currentX + 1 < width ? current + 1 : -1,
                                currentY > 0 ? current - width : -1,
                                currentY + 1 < height ? current + width : -1
                            };
                            foreach (int neighbor in neighbors)
                            {
                                if (neighbor < 0 || inspected[neighbor]) continue;
                                int neighborX = neighbor % width;
                                int neighborY = neighbor / width;
                                int neighborOffset = neighborY * stride + neighborX * 4;
                                if (!IsInteriorBackdrop(pixels[neighborOffset], pixels[neighborOffset + 1], pixels[neighborOffset + 2]))
                                {
                                    inspected[neighbor] = true;
                                    continue;
                                }
                                inspected[neighbor] = true;
                                componentQueue.Enqueue(neighbor);
                            }
                        }

                        if (component.Count >= 800)
                        {
                            foreach (int member in component) backdrop[member] = true;
                        }
                    }
                }

                for (int y = 0; y < height; y++)
                {
                    for (int x = 0; x < width; x++)
                    {
                        int index = y * width + x;
                        int offset = y * stride + x * 4;
                        if (backdrop[index])
                        {
                            pixels[offset + 3] = 0;
                            continue;
                        }

                        bool touchesBackdrop = false;
                        for (int oy = -2; oy <= 2 && !touchesBackdrop; oy++)
                        {
                            int py = y + oy;
                            if (py < 0 || py >= height) continue;
                            for (int ox = -2; ox <= 2; ox++)
                            {
                                int px = x + ox;
                                if (px < 0 || px >= width) continue;
                                if (backdrop[py * width + px])
                                {
                                    touchesBackdrop = true;
                                    break;
                                }
                            }
                        }

                        if (!touchesBackdrop) continue;
                        int blue = pixels[offset];
                        int green = pixels[offset + 1];
                        int red = pixels[offset + 2];
                        int min = Math.Min(red, Math.Min(green, blue));
                        int max = Math.Max(red, Math.Max(green, blue));
                        if (min >= 178 && max - min <= 58)
                        {
                            int alpha = Math.Max(0, Math.Min(255, (255 - min) * 4));
                            pixels[offset + 3] = (byte)Math.Min(pixels[offset + 3], alpha);
                        }
                    }
                }

                Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
                image.UnlockBits(data);

                string directory = Path.GetDirectoryName(outputPath);
                if (!String.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
                image.Save(outputPath, ImageFormat.Png);
            }
        }
    }
}
'@
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
[TowerDefense.AlphaMatte]::Remove($resolvedInput, $resolvedOutput)
