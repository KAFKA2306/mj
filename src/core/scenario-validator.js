/**
 * Scenario Validator
 * Provides deep, detailed validation for specific Mahjong scenarios.
 * Optimized for "Strong Player" logic validation.
 */
class ScenarioValidator {
    constructor(mahjongEngine, yakuCalculator, probabilityEngine) {
        this.engine = mahjongEngine;
        this.yakuCalculator = yakuCalculator;
        this.probabilityEngine = probabilityEngine;
    }
    /**
     * Validates a discard for Efficiency (1-Shanten / Efficiency Test) scenarios.
     * checks for Shanten loss and Ukeire counts.
     */
    validateEfficiency(hand, discardTile) {
        const possibleDiscards = hand;
        let bestUkeire = -1;
        let bestShanten = 9;
        const uniqueTiles = [...new Set(hand)];
        const analysis = uniqueTiles.map(tile => {
            const remainingHand = [...hand];
            const idx = remainingHand.indexOf(tile);
            if (idx > -1) remainingHand.splice(idx, 1);
            const shanten = this.engine.calculateShanten(remainingHand);
            const ukeire = this.engine.calculateUkeire(remainingHand);
            if (shanten < bestShanten) {
                bestShanten = shanten;
                bestUkeire = ukeire.total;
            } else if (shanten === bestShanten) {
                if (ukeire.total > bestUkeire) {
                    bestUkeire = ukeire.total;
                }
            }
            return { tile, shanten, ukeire: ukeire.total };
        });
        const userRemainingHand = [...hand];
        const userIdx = userRemainingHand.indexOf(discardTile);
        if (userIdx > -1) userRemainingHand.splice(userIdx, 1);
        const userShanten = this.engine.calculateShanten(userRemainingHand);
        const userUkeire = this.engine.calculateUkeire(userRemainingHand).total;
        if (userShanten > bestShanten) {
            return {
                isValid: false,
                rating: 'Bad',
                message: `シャンテン数が下がってしまいました（${bestShanten}向聴 → ${userShanten}向聴）。戻ってしまいます。`
            };
        }
        if (userUkeire < bestUkeire) {
            const loss = bestUkeire - userUkeire;
            if (loss <= 2) {
                return {
                    isValid: true,
                    rating: 'Good',
                    message: `ほぼ正解です。最大受け入れはあと${loss}枚多かったです。`
                };
            }
            return {
                isValid: false,
                rating: 'Suboptimal',
                message: `受け入れ枚数が最大ではありません（最大${bestUkeire}枚 vs あなた${userUkeire}枚）。ロス: ${loss}枚`
            };
        }
        return {
            isValid: true,
            rating: 'Excellent',
            message: `正解！受け入れ最大（${userUkeire}枚）の最善手です。`
        };
    }
    /**
     * Validates Defense scenarios.
     * Uses a Danger Map heuristic (Genbutsu, Suji, Kabe).
     */
    validateDefense(hand, discardTile, gameState) {
        const opponentDiscards = gameState.opponentDiscards || [];
        const isRiichi = gameState.riichiStick || false;
        const normalizedVisibleTiles = this.normalizeVisibleTiles(gameState.visibleTiles || {});
        if (this.checkGenbutsu(discardTile, opponentDiscards)) {
            return {
                isValid: true,
                rating: 'Excellent',
                message: `素晴らしい！「現物（Genbutsu）」です。100%安全な牌を選べています。`
            };
        }
        if (this.checkSuji(discardTile, opponentDiscards)) {
            return {
                isValid: true,
                rating: 'Good',
                message: `良い判断です。「スジ」を通しています。両面待ちには当たりません。`
            };
        }
        if (this.checkKabe(discardTile, normalizedVisibleTiles)) {
            return {
                isValid: true,
                rating: 'Good',
                message: `ナイス！「壁（カベ）」を利用して安全度を判断しました。`
            };
        }
        if (this.isHonorOrTerminal(discardTile)) {
            const visibleCount = normalizedVisibleTiles[discardTile] || 0;
            const hasOpponentContext = opponentDiscards.length > 0 || Object.keys(normalizedVisibleTiles).length > 0;
            if (!hasOpponentContext) {
                return {
                    isValid: true,
                    rating: 'Good',
                    message: `情報が無い状況では字牌/端牌を切って様子見するのが安全策です。`
                };
            }
            if (visibleCount >= 3) {
                return {
                    isValid: true,
                    rating: 'Great',
                    message: `3枚以上見えている字牌/端牌です。ほぼ安全です。`
                };
            }
            if (isRiichi && visibleCount === 0) {
                return {
                    isValid: false,
                    rating: 'Dangerous',
                    message: `危険！リーチに対して「生牌（ションパイ）」の字牌は危険です。`
                };
            }
        }
        const remainingHand = [...hand];
        const idx = remainingHand.indexOf(discardTile);
        if (idx > -1) remainingHand.splice(idx, 1);
        const shanten = this.engine.calculateShanten(remainingHand);
        if (shanten <= 0) {
            return {
                isValid: true,
                rating: 'Aggressive',
                message: `勝負！テンパイ維持のため危険牌を押しました。リスクに見合うリターンが必要です。`
            };
        }
        return {
            isValid: false,
            rating: 'Dangerous',
            message: `危険です！現物、スジ、壁など、より確実な安全牌を探しましょう。`
        };
    }
    checkGenbutsu(tile, discards) {
        const normalizedTile = this.normalizeRedFive(tile);
        const normalizedDiscards = discards.map(d => this.normalizeRedFive(d));
        return normalizedDiscards.includes(normalizedTile);
    }
    checkSuji(tile, discards) {
        const suit = tile.slice(-1);
        if (suit === 'z') return false;
        const num = this.getTileNumber(tile);
        const normalizedDiscards = discards.map(d => this.normalizeRedFive(d));
        if (num === 1) return normalizedDiscards.includes('4' + suit);
        if (num === 9) return normalizedDiscards.includes('6' + suit);
        if (num === 2) return normalizedDiscards.includes('5' + suit);
        if (num === 8) return normalizedDiscards.includes('5' + suit);
        if (num === 3) return normalizedDiscards.includes('6' + suit);
        if (num === 7) return normalizedDiscards.includes('4' + suit);
        if (num === 4) return normalizedDiscards.includes('1' + suit) && normalizedDiscards.includes('7' + suit);
        if (num === 5) return normalizedDiscards.includes('2' + suit) && normalizedDiscards.includes('8' + suit);
        if (num === 6) return normalizedDiscards.includes('3' + suit) && normalizedDiscards.includes('9' + suit);
        return false;
    }
    checkKabe(tile, visibleTiles) {
        const suit = tile.slice(-1);
        if (suit === 'z') return false;
        const num = this.getTileNumber(tile);
        const getCount = (n) => {
            const base = visibleTiles[n + suit] || 0;
            if (n === 5) {
                return base + (visibleTiles['0' + suit] || 0);
            }
            return base;
        };
        if (num === 1) return getCount(2) === 4 || getCount(3) === 4;
        if (num === 2) return getCount(3) === 4;
        if (num === 3) return getCount(4) === 4;
        if (num === 7) return getCount(6) === 4;
        if (num === 8) return getCount(7) === 4;
        if (num === 9) return getCount(8) === 4 || getCount(7) === 4;
        return false;
    }
    isHonorOrTerminal(tile) {
        const num = this.getTileNumber(tile);
        const suit = tile.slice(-1);
        return suit === 'z' || num === 1 || num === 9;
    }
    normalizeRedFive(tile) {
        if (!tile) return tile;
        const suit = tile.slice(-1);
        const num = tile.slice(0, -1);
        if (num === '0') return '5' + suit;
        return tile;
    }
    normalizeVisibleTiles(visibleTiles) {
        const merged = { ...visibleTiles };
        ['m', 'p', 's'].forEach(suit => {
            const redKey = '0' + suit;
            if (visibleTiles[redKey]) {
                merged['5' + suit] = (merged['5' + suit] || 0) + visibleTiles[redKey];
            }
        });
        return merged;
    }
    getTileNumber(tile) {
        const num = parseInt(tile.slice(0, -1));
        if (num === 0) return 5;
        return num;
    }
    /**
     * Helper for defense validation (Legacy/Simple check)
     */
    isTheoreticallySafe(tile, gameState) {
        return this.validateDefense([], tile, gameState).isValid;
    }
    /**
     * Validates Riichi Decision.
     */
    validateRiichiDecision(hand, isRiichiDeclared, gameState) {
        const analysis = this.yakuCalculator.analyzeHand(hand, { ...gameState, isRiichi: true });
        const damaAnalysis = this.yakuCalculator.analyzeHand(hand, { ...gameState, isRiichi: false });
        const riichiEV = analysis.expectedValue;
        const damaEV = damaAnalysis.expectedValue;
        if (isRiichiDeclared) {
            if (riichiEV > damaEV * 1.2) {
                return {
                    isValid: true,
                    rating: 'Excellent',
                    message: `正解！リーチによる打点上昇と圧力効果が見込めます。`
                };
            }
            if (damaEV > 5000 && riichiEV < damaEV * 1.1) {
                return {
                    isValid: false,
                    rating: 'Dubious',
                    message: `ダマテンでも十分に高い手です。リーチのリスクを負う必要は薄いかもしれません。`
                };
            }
        } else {
            if (riichiEV > damaEV * 1.5) {
                return {
                    isValid: false,
                    rating: 'Passive',
                    message: `この手はリーチすべきです！打点上昇が大きく、先制攻撃が有効です。`
                };
            }
        }
        return {
            isValid: true,
            rating: 'Good',
            message: `状況判断として妥当です。`
        };
    }
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScenarioValidator;
} else {
    window.ScenarioValidator = ScenarioValidator;
}
