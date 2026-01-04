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
        // 1. Calculate current state (before discard) - effectively "with discard candidate removed"
        // standard comparison is to check all OTHER possible discards.

        const possibleDiscards = hand; // In a real game, any tile in hand can be discarded.

        // Find the "Best" discard metrics
        let bestUkeire = -1;
        let bestShanten = 9;

        // Analyze all possible discards to find the baseline "Optimal"
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

        // Analyze User's Discard
        const userRemainingHand = [...hand];
        const userIdx = userRemainingHand.indexOf(discardTile);
        if (userIdx > -1) userRemainingHand.splice(userIdx, 1);

        const userShanten = this.engine.calculateShanten(userRemainingHand);
        const userUkeire = this.engine.calculateUkeire(userRemainingHand).total;

        // Feedback Logic
        if (userShanten > bestShanten) {
            return {
                isValid: false,
                rating: 'Bad',
                message: `シャンテン数が下がってしまいました（${bestShanten}向聴 → ${userShanten}向聴）。戻ってしまいます。`
            };
        }

        if (userUkeire < bestUkeire) {
            const loss = bestUkeire - userUkeire;
            // Allow minor sub-optimal plays if loss is small (e.g., < 2 tiles)
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
        // Opponent context from gameState (simulated or real)
        // Expected gameState structure for defense:
        // {
        //   opponentDiscards: ['1m', '4p', ...],
        //   riichiStick: true/false,
        //   visibleTiles: { '1m': 3, ... } // For Kabe
        // }

        const opponentDiscards = gameState.opponentDiscards || [];
        const isRiichi = gameState.riichiStick || false;
        const normalizedVisibleTiles = this.normalizeVisibleTiles(gameState.visibleTiles || {});

        // 1. GENBUTSU (Furiten / Safe against Riichi)
        if (this.checkGenbutsu(discardTile, opponentDiscards)) {
            return {
                isValid: true,
                rating: 'Excellent',
                message: `素晴らしい！「現物（Genbutsu）」です。100%安全な牌を選べています。`
            };
        }

        // 2. SUJI (Safe against Ryanmen if neighbor is safe)
        if (this.checkSuji(discardTile, opponentDiscards)) {
            return {
                isValid: true, // Generally valid defense
                rating: 'Good',
                message: `良い判断です。「スジ」を通しています。両面待ちには当たりません。`
            };
        }

        // 3. KABE (No Chance)
        if (this.checkKabe(discardTile, normalizedVisibleTiles)) {
            return {
                isValid: true,
                rating: 'Good',
                message: `ナイス！「壁（カベ）」を利用して安全度を判断しました。`
            };
        }

        // 4. HONOR TILES (Guests/terminals check)
        if (this.isHonorOrTerminal(discardTile)) {
            // Check if live (shonpai) -> Dangerous in riichi
            const visibleCount = normalizedVisibleTiles[discardTile] || 0;
            const hasOpponentContext = opponentDiscards.length > 0 || Object.keys(normalizedVisibleTiles).length > 0;

            // With no opponent info, honors/terminals are the default safe option.
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

        // 4. PUSH JUDGEMENT (If keeping tenpai/iishanten)
        // Only valid if the hand value is high enough or shanten is low enough
        const remainingHand = [...hand];
        const idx = remainingHand.indexOf(discardTile);
        if (idx > -1) remainingHand.splice(idx, 1);
        const shanten = this.engine.calculateShanten(remainingHand);

        if (shanten <= 0) { // Tenpai
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

    // --- Safety Check Helpers ---

    checkGenbutsu(tile, discards) {
        const normalizedTile = this.normalizeRedFive(tile);
        const normalizedDiscards = discards.map(d => this.normalizeRedFive(d));
        return normalizedDiscards.includes(normalizedTile);
    }

    checkSuji(tile, discards) {
        const suit = tile.slice(-1);
        if (suit === 'z') return false; // Honors have no suji

        const num = this.getTileNumber(tile);
        const normalizedDiscards = discards.map(d => this.normalizeRedFive(d));

        // Suji rules:
        // 1-4-7, 2-5-8, 3-6-9
        // To be safe as Suji 4, 1 must be discarded (or 7). Standard is:
        // Safe 1 if 4 is discarded.
        // Safe 4 if 1 AND 7 are discarded (Nakasu-ji).
        // Safe 7 if 4 is discarded.

        // Simplified "Outer Suji" check for this validator (1,2,3 from 4,5,6 and 7,8,9 from 4,5,6)

        // Case 1/9: Safe if 4/6 discarded
        if (num === 1) return normalizedDiscards.includes('4' + suit);
        if (num === 9) return normalizedDiscards.includes('6' + suit);

        // Case 2/8: Safe if 5 discarded
        if (num === 2) return normalizedDiscards.includes('5' + suit);
        if (num === 8) return normalizedDiscards.includes('5' + suit);

        // Case 3/7: Safe if 6/4 discarded
        if (num === 3) return normalizedDiscards.includes('6' + suit);
        if (num === 7) return normalizedDiscards.includes('4' + suit);

        // Middle tiles (4,5,6) need BOTH neighbors (Nakasu-ji)
        if (num === 4) return normalizedDiscards.includes('1' + suit) && normalizedDiscards.includes('7' + suit);
        if (num === 5) return normalizedDiscards.includes('2' + suit) && normalizedDiscards.includes('8' + suit);
        if (num === 6) return normalizedDiscards.includes('3' + suit) && normalizedDiscards.includes('9' + suit);

        return false;
    }

    checkKabe(tile, visibleTiles) {
        const suit = tile.slice(-1);
        if (suit === 'z') return false;
        const num = this.getTileNumber(tile);

        // No Chance: 4 visible tiles block ryanmen waits
        // Safe N if N-1 or N-2 cannot make a run because relevant connection is dead.

        // Check "One Out" Kabe (e.g., 8 is safe if 4x7 are visible) - Standard "Kabe" usually refers to finding safe outer tiles.
        // Safe 1: 4x2 visible? No ryanmen 2-3. 
        // Logic:
        // To wait on X, opp needs (X-1)(X-2) or (X+1)(X+2) or (X-1)(X+1).

        // Classic Kabe for Terminals/Outer:
        // Safe 1 and 2 if 4x3 are visible? No.
        // Safe 1: Needs 2-3 wait. If 4x2 visible, 2-3 is impossible? No.
        // If 4x '2' are visible -> 2-3 impossible -> 1 and 4 safe from 2-3 wait.
        // If 4x '3' are visible -> 2-3 impossible? No. 

        // Standard No Chance Rules:
        // If 4x '2' visible -> 1 is safe.
        // If 4x '3' visible -> 1, 2 safe.
        // If 4x '4' visible -> 2, 3 safe.
        // If 4x '5' visible -> 3, 7 safe? No.
        // If 4x '6' visible -> 7, 8 safe.
        // If 4x '7' visible -> 8, 9 safe.
        // If 4x '8' visible -> 9 safe.

        const getCount = (n) => {
            const base = visibleTiles[n + suit] || 0;
            if (n === 5) {
                // Red fives count toward the four-visible wall
                return base + (visibleTiles['0' + suit] || 0);
            }
            return base;
        };

        if (num === 1) return getCount(2) === 4 || getCount(3) === 4; // 2-3 or 3-? blocked
        if (num === 2) return getCount(3) === 4;
        if (num === 3) return getCount(4) === 4;
        // 4,5,6 less likely to be full safe just by one Kabe
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
        if (num === 0) return 5; // Treat red fives as standard 5s
        return num;
    }

    /**
     * Helper for defense validation (Legacy/Simple check)
     */
    isTheoreticallySafe(tile, gameState) {
        // Fallback to detailed check
        return this.validateDefense([], tile, gameState).isValid;
    }

    /**
     * Validates Riichi Decision.
     */
    validateRiichiDecision(hand, isRiichiDeclared, gameState) {
        // Logic: Riichi is good if:
        // 1. Waiting is good (Ryanmen+)
        // 2. Hand value increases significantly (low value -> high value)
        // 3. Early in game

        // Dama is good if:
        // 1. Hand is already high value (Mangan+) -> surprise attack
        // 2. Waiting is bad (Tanki/Penchan) and can improve
        // 3. Defensive situation

        // This requires EV calculation comparison
        const analysis = this.yakuCalculator.analyzeHand(hand, { ...gameState, isRiichi: true });
        const damaAnalysis = this.yakuCalculator.analyzeHand(hand, { ...gameState, isRiichi: false });

        const riichiEV = analysis.expectedValue;
        const damaEV = damaAnalysis.expectedValue;

        if (isRiichiDeclared) {
            if (riichiEV > damaEV * 1.2) { // Riichi offers significant gain
                return {
                    isValid: true,
                    rating: 'Excellent',
                    message: `正解！リーチによる打点上昇と圧力効果が見込めます。`
                };
            }
            if (damaEV > 5000 && riichiEV < damaEV * 1.1) { // High value dama, low gain riichi
                return {
                    isValid: false,
                    rating: 'Dubious',
                    message: `ダマテンでも十分に高い手です。リーチのリスクを負う必要は薄いかもしれません。`
                };
            }
        } else {
            // Chose Dama
            if (riichiEV > damaEV * 1.5) { // Riichi should have been declared
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

// Export for browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScenarioValidator;
} else {
    window.ScenarioValidator = ScenarioValidator;
}
