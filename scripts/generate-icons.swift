import AppKit
import Foundation

let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let manager = FileManager.default
let iconset = output.appendingPathComponent("icon.iconset", isDirectory: true)
try manager.createDirectory(at: iconset, withIntermediateDirectories: true)

func png(size: Int, tray: Bool = false) -> Data {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4,
        hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: size, height: size)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let transform = NSAffineTransform()
    transform.scale(by: CGFloat(size) / 1024)
    if tray {
        transform.translateX(by: 512, yBy: 512)
        transform.scale(by: 1.2)
        transform.translateX(by: -512, yBy: -512)
    }
    transform.concat()
    if !tray {
        NSColor(calibratedRed: 0.91, green: 0.93, blue: 0.87, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: 35, y: 35, width: 954, height: 954), xRadius: 220, yRadius: 220).fill()
        NSColor(calibratedRed: 0.985, green: 0.985, blue: 0.965, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: 235, y: 180, width: 554, height: 664), xRadius: 65, yRadius: 65).fill()
        NSColor(calibratedRed: 0.39, green: 0.49, blue: 0.34, alpha: 1).setStroke()
    } else { NSColor.black.setStroke() }
    let border = NSBezierPath(roundedRect: NSRect(x: 235, y: 180, width: 554, height: 664), xRadius: 65, yRadius: 65)
    border.lineWidth = tray ? 68 : 24
    border.stroke()
    let letter = NSBezierPath()
    letter.move(to: NSPoint(x: 350, y: 750))
    letter.line(to: NSPoint(x: 350, y: 560))
    letter.move(to: NSPoint(x: 470, y: 750))
    letter.line(to: NSPoint(x: 350, y: 648))
    letter.line(to: NSPoint(x: 470, y: 560))
    letter.lineWidth = tray ? 50 : 40
    letter.lineCapStyle = .round
    letter.lineJoinStyle = .round
    letter.stroke()
    for (x, y) in [(565, 560), (350, 425), (350, 300)] {
        let line = NSBezierPath()
        line.move(to: NSPoint(x: x, y: y))
        line.line(to: NSPoint(x: 680, y: y))
        line.lineWidth = tray ? 44 : 32
        line.lineCapStyle = .round
        line.stroke()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for size in [16, 32, 128, 256, 512] {
    try png(size: size).write(to: iconset.appendingPathComponent("icon_\(size)x\(size).png"))
    try png(size: size * 2).write(to: iconset.appendingPathComponent("icon_\(size)x\(size)@2x.png"))
}
try png(size: 36, tray: true).write(to: output.appendingPathComponent("trayTemplate@2x.png"))
try png(size: 18, tray: true).write(to: output.appendingPathComponent("trayTemplate.png"))
try png(size: 512).write(to: output.appendingPathComponent("icon.png"))
