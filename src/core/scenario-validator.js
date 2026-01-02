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
     * Uses a Danger Map heuristic (Suji, Honors, Genbutsu simulation).
     */
    validateDefense(hand, discardTile, gameState) {
        // In a real scenario, we'd have a specific opponent discard stream.
        // For now, we simulate "General Danger".
        // Safe: Genbutsu (if simulated), Honors (Guests 1), Terminals (sometimes).
        // Danger: Middle tiles (unless Suji).

        // Simulating a Riichi context from opposing player
        const isSafe = this.isTheoreticallySafe(discardTile, gameState);

        if (isSafe) {
            return {
                isValid: true,
                rating: 'Excellent',
                message: `素晴らしい！${discardTile}は比較的安全な牌です。`
            };
        }

        // If dangerous, check if it was necessary (e.g. pushing for Tenpai)
        const remainingHand = [...hand];
        const idx = remainingHand.indexOf(discardTile);
        if (idx > -1) remainingHand.splice(idx, 1);
        const shanten = this.engine.calculateShanten(remainingHand);

        if (shanten <= 0) { // Tenpai or Win
            return {
                isValid: true, // Risky but valid push
                rating: 'Aggressive',
                message: `危険牌ですが、聴牌維持のためには勝負手です。`
            };
        }

        return {
            isValid: false,
            rating: 'Dangerous',
            message: `危険です！現物やスジなど、より安全な牌を探しましょう。`
        };
    }

    // Helper for defense validation
    isTheoreticallySafe(tile, gameState) {
        const num = parseInt(tile.slice(0, -1));
        const suit = tile.slice(-1);

        // Honors are generally safer than middle tiles
        if (suit === 'z') return true;

        // Terminals
        if (num === 1 || num === 9) return true;

        // Simple Suji check (Simulated for validation purposes)
        // In a full implementation, we would check against 'gameState.opponentDiscards'
        return false;
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
