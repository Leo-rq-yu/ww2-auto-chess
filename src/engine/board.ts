import { Unit, Fortification } from '../types/units'

export const BOARD_WIDTH = 6
export const BOARD_HEIGHT = 6

export interface Position {
  x: number
  y: number
}

export class Board {
  private pieces: Map<string, Unit> = new Map()
  private fortifications: Map<string, Fortification> = new Map()

  constructor(
    pieces: Unit[] = [],
    fortifications: Fortification[] = []
  ) {
    pieces.forEach(piece => {
      if (piece.x !== undefined && piece.y !== undefined) {
        this.pieces.set(`${piece.x},${piece.y}`, piece)
      }
    })
    fortifications.forEach(fort => {
      this.fortifications.set(`${fort.x},${fort.y}`, fort)
    })
  }

  getPiece(x: number, y: number): Unit | undefined {
    return this.pieces.get(`${x},${y}`)
  }

  getFortification(x: number, y: number): Fortification | undefined {
    return this.fortifications.get(`${x},${y}`)
  }

  isOccupied(x: number, y: number): boolean {
    return this.pieces.has(`${x},${y}`) || this.fortifications.has(`${x},${y}`)
  }

  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT
  }

  placePiece(piece: Unit, x: number, y: number): boolean {
    if (!this.isValidPosition(x, y) || this.isOccupied(x, y)) {
      return false
    }
    piece.x = x
    piece.y = y
    this.pieces.set(`${x},${y}`, piece)
    return true
  }

  removePiece(x: number, y: number): Unit | undefined {
    const piece = this.pieces.get(`${x},${y}`)
    if (piece) {
      this.pieces.delete(`${x},${y}`)
      delete piece.x
      delete piece.y
    }
    return piece
  }

  movePiece(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const piece = this.removePiece(fromX, fromY)
    if (!piece) return false
    return this.placePiece(piece, toX, toY)
  }

  getAllPieces(): Unit[] {
    return Array.from(this.pieces.values())
  }

  getAllFortifications(): Fortification[] {
    return Array.from(this.fortifications.values())
  }

  addFortification(fort: Fortification): void {
    this.fortifications.set(`${fort.x},${fort.y}`, fort)
  }

  removeFortification(x: number, y: number): void {
    this.fortifications.delete(`${x},${y}`)
  }

  getState(): { pieces: Unit[]; fortifications: Fortification[] } {
    return {
      pieces: this.getAllPieces(),
      fortifications: this.getAllFortifications(),
    }
  }

  clone(): Board {
    const pieces = this.getAllPieces().map(p => ({ ...p }))
    const fortifications = this.getAllFortifications().map(f => ({ ...f }))
    return new Board(pieces, fortifications)
  }
}
