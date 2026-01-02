/**
 * UI Controller for Solo Mahjong Practice Machine
 * Handles user interaction and real-time analysis display
 * Optimized for 1 billion users with responsive design
 */

const READING_LESSONS = [
    {
        title: '捨て牌分析：ツモ切り vs 手出し',
        content: 'ツモ切り（引いた牌をそのまま捨てる）が続く場合、手が進行していないか、すでに聴牌（テンパイ）している可能性があります。逆に手出し（手の中から牌を選んで捨てる）が入ると、手が変化したサインです。'
    },
    {
        title: '役牌の「間（ま）」',
        content: '字牌を捨てる前に一瞬止まる場合、対子（トイツ）で持っていて、安全牌として残すか効率のために捨てるか迷っていた可能性があります。'
    },
    {
        title: '染め手の溢れ',
        content: '特定の色の牌ばかり捨てられている場合、残りの色で染め手（混一色・清一色）を作っている可能性が高いです。余剰牌が出てきたら要注意です。'
    },
    {
        title: '端牌の切り出し',
        content: '1や9の早い切り出しはタンヤオ狙いのことが多いです。終盤での生牌（ションパイ）の字牌・端牌切りは、テンパイ、あるいはテンパイに近い強いサインです。'
    },
    {
        title: 'スジの罠',
        content: '上級者は、あなたがスジ（1-4-7の安全性など）を信頼していることを知っています。あえて安全そうなスジに見せかけた単騎待ちで罠を仕掛けることがあります。'
    }
];

class UIController {
    constructor() {
        this.engine = new MahjongEngine();
        this.yakuCalculator = new YakuCalculator();
        this.probabilityEngine = new ProbabilityEngine();

        this.currentHand = [];
        this.selectedTiles = new Set();
        this.analysisCache = new Map();
        this.isAnalyzing = false;

        // Real-time analysis settings
        this.ANALYSIS_DEBOUNCE_MS = 500;
        this.analysisTimer = null;

        // Performance monitoring for 1B users
        this.performanceMonitor = {
            renderTime: 0,
            analysisTime: 0,
            memoryUsage: 0
        };

        this.initializeEventListeners();
        this.startPerformanceMonitoring();
    }

    initializeEventListeners() {
        // Prevent default touch behaviors for mobile optimization
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });

        // Keyboard shortcuts for power users
        document.addEventListener('keydown', this.handleKeyboard.bind(this));

        // Resize handler for responsive design
        window.addEventListener('resize', this.handleResize.bind(this));

        // Visibility change for battery optimization
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    // Main UI initialization
    async initialize() {
        await this.loadSettings();
        this.newHand();
    }

    // Generate new practice hand
    async newHand() {
        const startTime = performance.now();

        this.showLoadingState();
        this.selectedTiles.clear();

        try {
            // Generate realistic practice scenarios
            this.currentHand = this.generatePracticeScenario();
            this.renderHand();
            this.renderWall();

            // Perform real-time analysis
            await this.performAnalysis();

        } catch (error) {
            console.error('Error generating new hand:', error);
            this.showErrorState('配牌の生成に失敗しました。もう一度お試しください。');
        } finally {
            this.hideLoadingState();
            this.updatePerformanceMetrics('render', performance.now() - startTime);
        }
    }

    // Generate realistic practice scenarios
    generatePracticeScenario() {
        // Generate a more realistic random hand
        const hand = [];
        const allTiles = [];

        // Create available tiles (4 of each)
        for (let suit of ['m', 'p', 's']) {
            for (let num = 1; num <= 9; num++) {
                for (let i = 0; i < 4; i++) {
                    allTiles.push(num + suit);
                }
            }
        }
        for (let honor = 1; honor <= 7; honor++) {
            for (let i = 0; i < 4; i++) {
                allTiles.push(honor + 'z');
            }
        }

        // Shuffle and take 13 tiles
        for (let i = allTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
        }

        return allTiles.slice(0, 13).sort(this.engine.compareTiles);
    }

    createScenarioHand(scenarioType) {
        switch (scenarioType) {
            case 'iishanten_multiple_waits':
                return this.createIishantenHand();
            case 'riichi_decision':
                return this.createRiichiDecisionHand();
            case 'defensive_play':
                return this.createDefensiveHand();
            case 'yaku_building':
                return this.createYakuBuildingHand();
            case 'efficiency_test':
                return this.createEfficiencyTestHand();
            case 'complex_wait_patterns':
                return this.createComplexWaitHand();
            case 'opponent_reading':
                return this.createOpponentReadingHand();
            default:
                return this.engine.dealInitialHand();
        }
    }

    // Scenario generators
    createIishantenHand() {
        // Create a hand that's 1-shanten with multiple good waits
        return ['1m', '2m', '3m', '4m', '5m', '6m', '7p', '8p', '9p', '2s', '3s', '4s', '5z'];
    }

    createRiichiDecisionHand() {
        // Create a hand where riichi decision is non-trivial
        return ['2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '4p', '6s', '7s', '8s', '1z'];
    }

    createDefensiveHand() {
        // Create a hand requiring defensive play
        return ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'];
    }

    createYakuBuildingHand() {
        // Create a hand with multiple yaku possibilities
        return ['1m', '1m', '2m', '3m', '7m', '7m', '7m', '2p', '3p', '4p', '5s', '6s', '7s'];
    }

    createEfficiencyTestHand() {
        // Create a hand testing tile efficiency knowledge
        return ['1m', '3m', '4m', '6m', '7m', '2p', '4p', '5p', '7p', '8p', '3s', '5s', '6s'];
    }

    createComplexWaitHand() {
        // Create a hand with complex wait patterns
        return ['2m', '3m', '4m', '5m', '6m', '7m', '2p', '2p', '3p', '4p', '5s', '6s', '7s'];
    }

    createOpponentReadingHand() {
        // "Nanikiru" scenario requires 14 tiles (13 + 1 drawn)
        // Hand: 123m 456p 789s 11z 222z (14th tile is 2z)
        // This is a complete hand, but for reading practice we can give a hand 
        // that requires a choice, e.g., a dangerous tile drawn.
        // Let's give a hand that is 1-shanten or tenpai but requires a safe discard.
        // Hand: 234m 567p 123s 99p 5z 5z (14 tiles: Tenpai for 9p/5z if we discard one?)
        // Actually, let's just add one tile to the defensive hand idea, or standard hand.
        // Defensive hand + 1 unsafe tile to discard?
        return ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z', '5p'];
    }

    // Hand rendering with performance optimization
    renderHand() {
        const container = document.getElementById('playerHand');
        const fragment = document.createDocumentFragment();

        this.currentHand.forEach((tile, index) => {
            const tileElement = this.createTileElement(tile, index);
            fragment.appendChild(tileElement);
        });

        // Batch DOM update for performance
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    createTileElement(tile, index) {
        const tileElement = document.createElement('div');
        tileElement.className = 'tile';

        // Try Unicode first, fallback to text representation
        const unicodeTile = this.engine.TILE_UNICODE[tile];
        if (unicodeTile) {
            tileElement.textContent = unicodeTile;
        } else {
            // Fallback to readable text
            tileElement.textContent = this.formatTileText(tile);
            tileElement.classList.add('fallback');
        }

        tileElement.dataset.tile = tile;
        tileElement.dataset.index = index;

        // Event listeners
        tileElement.addEventListener('click', (e) => this.handleTileClick(e));
        tileElement.addEventListener('touchstart', (e) => this.handleTileTouch(e));

        // Accessibility
        tileElement.setAttribute('role', 'button');
        tileElement.setAttribute('tabindex', '0');
        tileElement.setAttribute('aria-label', `Tile ${this.formatTileText(tile)}`);

        return tileElement;
    }

    formatTileText(tile) {
        const suit = tile.slice(-1);
        const num = parseInt(tile.slice(0, -1));

        const suitNames = {
            'm': 'M',  // Man/Characters
            'p': 'P',  // Pin/Circles
            's': 'S',  // Sou/Bamboo
            'z': ['E', 'S', 'W', 'N', 'W', 'G', 'R'][num - 1] || 'H' // Winds/Dragons
        };

        if (suit === 'z') {
            return suitNames[suit];
        } else {
            return num + suitNames[suit];
        }
    }

    // Wall rendering
    renderWall() {
        const wallDisplay = document.getElementById('wallDisplay');
        const wallCount = document.getElementById('wallCount');

        const remaining = this.engine.wall.length;
        wallCount.textContent = remaining;

        // Visual wall representation
        wallDisplay.innerHTML = '';
        const wallTiles = Math.min(70, remaining);

        for (let i = 0; i < wallTiles; i++) {
            const wallTile = document.createElement('div');
            wallTile.className = 'wall-tile';
            wallDisplay.appendChild(wallTile);
        }
    }

    // Real-time analysis with debouncing
    async performAnalysis(force = false) {
        if (this.isAnalyzing && !force) return;

        // Debounce analysis for performance
        if (this.analysisTimer) {
            clearTimeout(this.analysisTimer);
        }

        this.analysisTimer = setTimeout(async () => {
            await this.runAnalysis();
        }, this.ANALYSIS_DEBOUNCE_MS);
    }

    async runAnalysis() {
        if (this.isAnalyzing) return;

        this.isAnalyzing = true;
        const startTime = performance.now();

        try {
            const gameState = this.getCurrentGameState();

            // Parallel analysis execution
            const [yakuAnalysis, probabilityAnalysis] = await Promise.all([
                this.yakuCalculator.analyzeHand(this.currentHand, gameState),
                this.probabilityEngine.calculateExpectedValue(this.currentHand, gameState, {
                    iterations: 5000,
                    includeRisk: true
                })
            ]);

            // Update UI with results
            this.displayYakuAnalysis(yakuAnalysis);
            this.displayProbabilityAnalysis(probabilityAnalysis);
            this.displayScientificMetrics(yakuAnalysis, probabilityAnalysis);

        } catch (error) {
            console.error('Analysis error:', error);
            this.showAnalysisError();
        } finally {
            this.isAnalyzing = false;
            this.updatePerformanceMetrics('analysis', performance.now() - startTime);
        }
    }

    // Analysis display methods
    displayYakuAnalysis(analysis) {
        const yakuList = document.getElementById('yakuList');
        yakuList.innerHTML = '';

        // Combine completed and potential yaku
        const allYaku = [...(analysis.completedYaku || []), ...(analysis.potentialYaku || [])];

        if (allYaku.length === 0) {
            yakuList.innerHTML = '<div class="no-yaku">役が見つかりません。基本的な形を作ることに集中しましょう。</div>';
            return;
        }

        // Sort by expected value
        allYaku.sort((a, b) => (b.expectedValue || 0) - (a.expectedValue || 0));

        allYaku.forEach(yaku => {
            const yakuElement = this.createYakuElement(yaku);
            yakuList.appendChild(yakuElement);
        });
    }

    createYakuElement(yaku) {
        const element = document.createElement('div');
        element.className = 'yaku-item';
        element.innerHTML = `
            <div class="yaku-info">
                <div class="yaku-name">${this.formatYakuName(yaku.name)}</div>
                <div class="yaku-probability">${(yaku.probability * 100).toFixed(1)}% の確率</div>
            </div>
            <div class="yaku-value">${yaku.han || 1}H | ${(yaku.expectedValue || 0).toLocaleString()}pts</div>
        `;

        // Add tooltip with description
        element.title = yaku.description || '説明はありません';

        return element;
    }

    displayProbabilityAnalysis(analysis) {
        // Update stat cards
        document.getElementById('winProbability').textContent =
            (analysis.winProbability * 100).toFixed(1) + '%';
        document.getElementById('expectedValue').textContent =
            analysis.expectedValue.toLocaleString();
        document.getElementById('avgHan').textContent =
            (analysis.averagePoints / 1000).toFixed(1);
        document.getElementById('dealInRisk').textContent =
            ((analysis.riskAssessment?.dealInProbability || 0) * 100).toFixed(1) + '%';
    }

    displayScientificMetrics(yakuAnalysis, probabilityAnalysis) {
        const metrics = {
            ...yakuAnalysis.scientificMetrics,
            ...probabilityAnalysis.scientificMetrics
        };

        // Display advanced metrics for scientific users
        if (metrics.shantenNumber !== undefined) {
            this.updateMetricDisplay('shanten', metrics.shantenNumber);
        }

        if (metrics.ukeireCount !== undefined) {
            this.updateMetricDisplay('ukeire', metrics.ukeireCount);
        }

        if (metrics.efficiencyRating !== undefined) {
            this.updateMetricDisplay('efficiency', (metrics.efficiencyRating * 100).toFixed(1) + '%');
        }
    }

    // User interaction handlers
    handleTileClick(event) {
        const tile = event.target.dataset.tile;
        const index = parseInt(event.target.dataset.index);

        if (this.selectedTiles.has(index)) {
            this.selectedTiles.delete(index);
            event.target.classList.remove('selected');
        } else {
            this.selectedTiles.add(index);
            event.target.classList.add('selected');
        }

        this.updateSelectionActions();
    }

    handleTileTouch(event) {
        event.preventDefault();
        this.handleTileClick(event);
    }

    handleKeyboard(event) {
        switch (event.key) {
            case 'n':
            case 'N':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.newHand();
                }
                break;
            case 'a':
            case 'A':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.analyzeBestPlay();
                }
                break;
            case 'r':
            case 'R':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.riichi();
                }
                break;
            case 'Escape':
                this.clearSelection();
                break;
        }
    }

    // Action methods
    async analyzeBestPlay() {
        if (this.isAnalyzing) return;

        this.showAnalysisLoadingState();

        try {
            const gameState = this.getCurrentGameState();

            // Calculate expected value for each possible discard
            // Pass the current scenario type for context-aware analysis
            const bestPlay = this.calculateOptimalDiscard(this.currentScenarioType);

            this.displayBestPlayRecommendation(bestPlay);

        } catch (error) {
            console.error('Best play analysis error:', error);
            this.showErrorMessage('分析に失敗しました。基本的な推奨を表示します。');

            // Fallback: simple recommendation
            this.displayBasicRecommendation();
        } finally {
            this.hideAnalysisLoadingState();
        }
    }

    calculateOptimalDiscard(scenarioType) {
        if (this.currentHand.length === 0) {
            return {
                tile: null,
                expectedValue: 0,
                reasoning: '分析可能な牌がありません'
            };
        }

        let bestDiscard = {
            tile: null,
            expectedValue: -Infinity,
            ukeire: 0,
            shanten: 8,
            reasoning: '効率のために温存'
        };

        // Determine critical thinking context based on scenario
        const isDefensive = scenarioType === 'defensive_play' || scenarioType === 'opponent_reading';
        const isYakuFocused = scenarioType === 'yaku_building';

        // Analyze each possible discard
        for (let i = 0; i < this.currentHand.length; i++) {
            const testTile = this.currentHand[i];
            const remainingHand = [...this.currentHand];
            remainingHand.splice(i, 1);

            // Calculate metrics for this discard
            const shanten = this.engine.calculateShanten ?
                this.engine.calculateShanten(remainingHand) : 3;
            const ukeire = this.engine.calculateUkeire ?
                this.engine.calculateUkeire(remainingHand) : { total: 4 };

            // Base scoring: efficiency
            let score = (8 - shanten) * 10 + ukeire.total;

            // Critical thinking adjustments
            if (isDefensive) {
                // In defensive/reading scenarios, prioritize safe tiles (terminals/honors) if shanten is high
                if (shanten >= 2) {
                    const isSafe = this.isTheoreticallySafe(testTile);
                    if (isSafe) score += 5; // Boost safe tiles
                }
            }

            if (isYakuFocused && shanten >= 1) {
                // In yaku building, slight boost to Tanyao potential (simulated)
                const isSimple = !this.isTerminalOrHonor(testTile);
                if (isSimple) score += 2;
            }

            if (score > bestDiscard.expectedValue) {
                bestDiscard = {
                    tile: testTile,
                    expectedValue: score,
                    ukeire: ukeire.total,
                    shanten: shanten,
                    reasoning: this.generateDiscardReasoning(testTile, shanten, ukeire.total, scenarioType)
                };
            }
        }

        return bestDiscard;
    }

    isTerminalOrHonor(tile) {
        const num = parseInt(tile.slice(0, -1));
        const suit = tile.slice(-1);
        return suit === 'z' || num === 1 || num === 9;
    }

    isTheoreticallySafe(tile) {
        // Simplified safety check for defensive scenarios
        // Assume Genbutsu/Suji logic would go here
        return this.isTerminalOrHonor(tile); // Just a heuristic for now
    }

    generateDiscardReasoning(tile, shanten, ukeire, scenarioType) {
        // Critical Thinking: Context-aware reasoning
        const tileText = this.formatTileText(tile);

        if (scenarioType === 'opponent_reading') {
            return `${tileText}切り - 相手の読みを考慮しつつ、${shanten}向聴で受け入れ${ukeire}枚を確保します。`;
        }

        if (scenarioType === 'defensive_play') {
            if (this.isTheoreticallySafe(tile)) {
                return `${tileText}切り - 安全度を重視しつつ手を進めます（${shanten}向聴）。`;
            }
        }

        if (scenarioType === 'yaku_building') {
            return `${tileText}切り - 手役の可能性を残し、効率を最大化します（${shanten}向聴）。`;
        }

        if (shanten === 0) {
            return `${tileText}切り - 聴牌（受け入れ${ukeire}枚）`;
        } else if (shanten === 1) {
            return `${tileText}切り - 一向聴（良形受け入れ${ukeire}枚）`;
        } else if (shanten === 2) {
            return `${tileText}切り - 二向聴維持（受け入れ${ukeire}枚）`;
        } else {
            return `${tileText}切り - 牌効率向上（${shanten}向聴、受け入れ${ukeire}枚）`;
        }
    }

    displayBasicRecommendation() {
        // Simple fallback recommendation
        if (this.currentHand.length > 0) {
            const randomTile = this.currentHand[Math.floor(Math.random() * this.currentHand.length)];
            this.displayBestPlayRecommendation({
                tile: randomTile,
                expectedValue: 1000,
                reasoning: '基本的な推奨打牌 - 牌効率と手役の可能性を考慮'
            });
        }
    }

    async showAllPossibilities() {
        try {
            this.showAnalysisLoadingState();

            const gameState = this.getCurrentGameState();
            const analysis = await this.yakuCalculator.analyzeHand(this.currentHand, gameState);

            // Add basic hand metrics
            const shanten = this.engine.calculateShanten ?
                this.engine.calculateShanten(this.currentHand) : 'Unknown';
            const ukeire = this.engine.calculateUkeire ?
                this.engine.calculateUkeire(this.currentHand) : { total: 0, waits: [] };

            // Enhance analysis with calculated metrics
            analysis.shanten = shanten;
            analysis.ukeire = ukeire.total;
            analysis.waits = ukeire.waits || [];

            this.displayComprehensiveAnalysis(analysis);

        } catch (error) {
            console.error('Show possibilities error:', error);
            this.showErrorMessage('分析に失敗しました。もう一度お試しください。');
        } finally {
            this.hideAnalysisLoadingState();
        }
    }

    riichi() {
        if (!this.engine.isTenpai(this.currentHand)) {
            this.showErrorMessage('リーチできません - 聴牌していません！');
            return;
        }

        this.engine.isRiichi = true;
        this.showSuccessMessage('リーチ宣言！ 🚀');
        this.performAnalysis(true);
    }

    async loadPracticeScenario(scenarioType) {
        this.showLoadingState();

        try {
            // Load specific scenario hand
            // Special handling for reading training
            if (scenarioType === 'opponent_reading') {
                this.loadReadingLesson();
            }

            this.currentHand = this.createScenarioHand(scenarioType);
            this.selectedTiles.clear();

            // Update display
            this.renderHand();
            this.renderWall();

            // Show scenario-specific guidance
            this.showScenarioGuidance(scenarioType);

            // Perform analysis
            await this.performAnalysis(true);

            this.showSuccessMessage(`${this.formatScenarioName(scenarioType)} シナリオを読み込みました！ 🎯`);

        } catch (error) {
            console.error('Error loading scenario:', error);
            this.showErrorMessage('練習シナリオの読み込みに失敗しました。もう一度お試しください。');
        } finally {
            this.hideLoadingState();
            // Set current Scenario Type for analysis context
            this.currentScenarioType = scenarioType;
        }
    }

    loadReadingLesson() {
        // Select a random lesson
        const lesson = READING_LESSONS[Math.floor(Math.random() * READING_LESSONS.length)];

        // Use a persistent toast or specific modal for the lesson
        // For simplicity, using a long-duration success message for now, 
        // ideally this should be a modal or a dismissible alert

        const message = `📚 【読みの学習】\n${lesson.title}\n\n${lesson.content}`;

        // Force a slightly longer timeout for this lesson toast if possible, 
        // or just rely on showMessage default (3s might be short)
        // Let's create a custom alert for this
        alert(message); // Simple and effective for attention
    }

    showScenarioGuidance(scenarioType) {
        const guidance = {
            'iishanten': '牌効率と多面待ちに集中してください。最も受け入れ枚数の多い打牌を探しましょう。',
            'riichi_decision': 'リーチするかダマテンに構えるかを判断します。手役の高さ、待ちの良さ、局面を考慮しましょう。',
            'defensive': '危険牌を読み、安牌を選ぶ練習です。相手の捨て牌や鳴きに注目しましょう。',
            'yaku_building': '複数の手役の可能性を追求しましょう。どの役が最も実現可能性が高いかを考えます。',
            'efficiency_test': '牌効率の知識を試します。和了への最短ルートとなる打牌を選びましょう。',
            'complex_wait_patterns': '複雑な待ちのパターンとその価値を学びます。多面待ちの理解は上級者への第一歩です。',
            'opponent_reading': '相手の捨て牌や挙動から手牌を読む「読み」の基礎を学びます。'
        };

        const message = guidance[scenarioType] || 'このシナリオで麻雀のスキルを磨きましょう！';
        this.showMessage(message, 'info');
    }

    formatScenarioName(scenarioType) {
        const names = {
            'iishanten': '一向聴マスター',
            'riichi_decision': 'リーチ判断',
            'defensive': '守備の練習',
            'yaku_building': '手役作り',
            'efficiency_test': '牌効率テスト',
            'complex_wait_patterns': '多面待ちパターン',
            'opponent_reading': '相手の読みと心理'
        };

        return names[scenarioType] || scenarioType;
    }

    // Utility methods
    getCurrentGameState() {
        return {
            turn: this.engine.round,
            isRiichi: this.engine.isRiichi,
            isConcealed: true,
            playerWind: this.engine.playerWind,
            roundWind: this.engine.roundWind,
            wallSize: this.engine.wall.length,
            isTenpai: this.engine.isTenpai(this.currentHand)
        };
    }

    formatYakuName(yakuName) {
        const yakuNames = {
            'riichi': '立直',
            'menzen_tsumo': '門前清自摸和',
            'ippatsu': '一発',
            'tanyao': '断么九',
            'pinfu': '平和',
            'iipeikou': '一盃口',
            'yakuhai_dragon': '役牌（三元牌）',
            'yakuhai_seat': '役牌（自風）',
            'yakuhai_round': '役牌（場風）',
            'sanshoku_doujun': '三色同順',
            'ittsu': '一気通貫',
            'chanta': '混全帯么九',
            'chitoitsu': '七対子',
            'toitoi': '対々和',
            'sanankou': '三暗刻',
            'honitsu': '混一色',
            'chinitsu': '清一色'
        };

        return yakuNames[yakuName] || yakuName;
    }

    // UI state management
    showLoadingState() {
        document.body.classList.add('loading');
    }

    hideLoadingState() {
        document.body.classList.remove('loading');
    }

    showAnalysisLoadingState() {
        document.getElementById('yakuAnalysis').classList.add('loading');
    }

    hideAnalysisLoadingState() {
        document.getElementById('yakuAnalysis').classList.remove('loading');
    }

    showErrorState(message) {
        this.showMessage(message, 'error');
    }

    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        const container = document.getElementById('toastContainer') || document.body;
        container.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        setInterval(() => {
            if (performance.memory) {
                this.performanceMonitor.memoryUsage = performance.memory.usedJSHeapSize;
            }

            // Log performance metrics for optimization
            if (this.performanceMonitor.renderTime > 100) {
                console.warn('Slow render detected:', this.performanceMonitor.renderTime + 'ms');
            }

            if (this.performanceMonitor.analysisTime > 2000) {
                console.warn('Slow analysis detected:', this.performanceMonitor.analysisTime + 'ms');
            }
        }, 5000);
    }

    updatePerformanceMetrics(type, time) {
        this.performanceMonitor[type + 'Time'] = time;
    }

    // Settings management
    async loadSettings() {
        try {
            const settings = localStorage.getItem('mahjongPracticeSettings');
            if (settings) {
                this.settings = JSON.parse(settings);
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    async saveSettings() {
        try {
            localStorage.setItem('mahjongPracticeSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    // Mobile optimization
    handleTouchStart(event) {
        if (event.target.classList.contains('tile')) {
            event.preventDefault();
        }
    }

    handleTouchMove(event) {
        if (event.target.classList.contains('tile')) {
            event.preventDefault();
        }
    }

    handleResize() {
        // Responsive layout adjustments
        this.optimizeLayoutForViewport();
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Pause intensive calculations when tab is hidden
            if (this.analysisTimer) {
                clearTimeout(this.analysisTimer);
            }
        } else {
            // Resume analysis when tab becomes visible
            this.performAnalysis();
        }
    }

    optimizeLayoutForViewport() {
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('mobile-layout', isMobile);
    }

    // Implementation of display methods
    updateSelectionActions() {
        // Update UI based on selected tiles
        const selectedCount = this.selectedTiles.size;
        // Could add selection-specific buttons here
    }

    clearSelection() {
        this.selectedTiles.clear();
        // Remove selection styling from all tiles
        document.querySelectorAll('.tile.selected').forEach(tile => {
            tile.classList.remove('selected');
        });
    }

    updateMetricDisplay(metric, value) {
        console.log(`${metric}: ${value}`);
        // Could update specific metric displays here
    }

    displayBestPlayRecommendation(bestPlay) {
        if (!bestPlay || !bestPlay.tile) {
            this.showErrorMessage('推奨情報がありません');
            return;
        }

        // Highlight the recommended discard
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            tile.classList.remove('highlighted');
            if (tile.dataset.tile === bestPlay.tile) {
                tile.classList.add('highlighted');
            }
        });

        // Show reasoning in a toast
        this.showMessage(`💡 ${bestPlay.reasoning}`, 'info');
    }

    displayComprehensiveAnalysis(analysis) {
        const modalContent = document.getElementById('detailedAnalysis');
        if (!modalContent) return;

        let content = '<h4>🔬 手牌詳細分析</h4>';

        // Hand Status
        content += '<h5>📋 現在の手牌:</h5>';
        content += `<p><strong>シャンテン数:</strong> ${analysis.shanten !== undefined ? analysis.shanten : '計算中...'}</p>`;
        content += `<p><strong>有効牌（受け入れ）:</strong> ${analysis.ukeire !== undefined ? analysis.ukeire : 0} 枚</p>`;

        if (analysis.waits && analysis.waits.length > 0) {
            content += `<p><strong>待ち牌:</strong> ${analysis.waits.map(tile => this.formatTileText(tile)).join(', ')}</p>`;
        }

        if (analysis.completedYaku && analysis.completedYaku.length > 0) {
            content += '<h5>✅ 成立している役:</h5><ul>';
            analysis.completedYaku.forEach(yaku => {
                content += `<li><strong>${this.formatYakuName(yaku.name)}</strong> (${yaku.han}H) - ${(yaku.probability * 100).toFixed(1)}%</li>`;
            });
            content += '</ul>';
        }

        if (analysis.potentialYaku && analysis.potentialYaku.length > 0) {
            content += '<h5>🎯 成立の可能性がある役:</h5><ul>';
            analysis.potentialYaku.forEach(yaku => {
                content += `<li><strong>${this.formatYakuName(yaku.name)}</strong> (${yaku.han}H) - ${(yaku.probability * 100).toFixed(1)}%</li>`;
            });
            content += '</ul>';
        }

        if (!analysis.completedYaku?.length && !analysis.potentialYaku?.length) {
            content += '<p><em>役が見つかりません。順子や対子を作るなど、基本的な手作りを目指しましょう。</em></p>';
        }

        content += `<h5>📊 統計データ:</h5>`;
        content += `<p><strong>期待値:</strong> ${analysis.expectedValue || 0} 点</p>`;
        content += `<p><strong>和了確率:</strong> ${((analysis.winProbability || 0) * 100).toFixed(1)}%</p>`;
        content += `<p><strong>放銃リスク:</strong> ${((analysis.dealInRisk || 0) * 100).toFixed(1)}%</p>`;

        modalContent.innerHTML = content;
        document.getElementById('analysisModal').style.display = 'block';
    }

    showAnalysisError() {
        this.showErrorMessage('分析に失敗しました。もう一度お試しください。');
    }
}

// Global functions for HTML buttons
let uiController;

window.addEventListener('DOMContentLoaded', async () => {
    uiController = new UIController();
    await uiController.initialize();
});

function newHand() {
    if (uiController) uiController.newHand();
}

function analyzeBestPlay() {
    if (uiController) uiController.analyzeBestPlay();
}

function showAllPossibilities() {
    if (uiController) uiController.showAllPossibilities();
}

function riichi() {
    if (uiController) uiController.riichi();
}

function openScenarios() {
    document.getElementById('scenarioModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('scenarioModal').style.display = 'none';
    document.getElementById('analysisModal').style.display = 'none';
}

function loadScenario(scenarioType) {
    if (uiController) {
        closeModal();
        uiController.loadPracticeScenario(scenarioType);
    }
}

// Close modal when clicking outside
window.onclick = function (event) {
    const scenarioModal = document.getElementById('scenarioModal');
    const analysisModal = document.getElementById('analysisModal');

    if (event.target === scenarioModal) {
        scenarioModal.style.display = 'none';
    }
    if (event.target === analysisModal) {
        analysisModal.style.display = 'none';
    }
}

// Export for module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}