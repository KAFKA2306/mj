/**
 * UI Controller for Solo Mahjong Practice Machine
 * Handles user interaction and real-time analysis display
 * Optimized for 1 billion users with responsive design
 */

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
            this.showErrorState('Failed to generate hand. Please try again.');
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
            yakuList.innerHTML = '<div class="no-yaku">No yaku detected. Focus on building basic patterns.</div>';
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
                <div class="yaku-probability">${(yaku.probability * 100).toFixed(1)}% chance</div>
            </div>
            <div class="yaku-value">${yaku.han || 1}H | ${(yaku.expectedValue || 0).toLocaleString()}pts</div>
        `;
        
        // Add tooltip with description
        element.title = yaku.description || 'No description available';
        
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
            const bestPlay = this.calculateOptimalDiscard();
            
            this.displayBestPlayRecommendation(bestPlay);
            
        } catch (error) {
            console.error('Best play analysis error:', error);
            this.showErrorMessage('Analysis failed. Using basic recommendation.');
            
            // Fallback: simple recommendation
            this.displayBasicRecommendation();
        } finally {
            this.hideAnalysisLoadingState();
        }
    }

    calculateOptimalDiscard() {
        if (this.currentHand.length === 0) {
            return {
                tile: null,
                expectedValue: 0,
                reasoning: 'No tiles to analyze'
            };
        }

        let bestDiscard = {
            tile: null,
            expectedValue: -Infinity,
            ukeire: 0,
            shanten: 8,
            reasoning: 'Keep for efficiency'
        };

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
            
            // Simple scoring: lower shanten is better, more ukeire is better
            const score = (8 - shanten) * 10 + ukeire.total;
            
            if (score > bestDiscard.expectedValue) {
                bestDiscard = {
                    tile: testTile,
                    expectedValue: score,
                    ukeire: ukeire.total,
                    shanten: shanten,
                    reasoning: this.generateDiscardReasoning(testTile, shanten, ukeire.total)
                };
            }
        }

        return bestDiscard;
    }

    generateDiscardReasoning(tile, shanten, ukeire) {
        if (shanten === 0) {
            return `Discard ${this.formatTileText(tile)} - Hand is tenpai with ${ukeire} acceptance tiles`;
        } else if (shanten === 1) {
            return `Discard ${this.formatTileText(tile)} - Reaches 1-shanten with ${ukeire} good waits`;
        } else if (shanten === 2) {
            return `Discard ${this.formatTileText(tile)} - Maintains 2-shanten with ${ukeire} acceptance tiles`;
        } else {
            return `Discard ${this.formatTileText(tile)} - Improves hand efficiency (${shanten}-shanten, ${ukeire} tiles)`;
        }
    }

    displayBasicRecommendation() {
        // Simple fallback recommendation
        if (this.currentHand.length > 0) {
            const randomTile = this.currentHand[Math.floor(Math.random() * this.currentHand.length)];
            this.displayBestPlayRecommendation({
                tile: randomTile,
                expectedValue: 1000,
                reasoning: 'Basic recommendation - consider hand efficiency and yaku potential'
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
            this.showErrorMessage('Failed to analyze possibilities. Please try again.');
        } finally {
            this.hideAnalysisLoadingState();
        }
    }

    riichi() {
        if (!this.engine.isTenpai(this.currentHand)) {
            this.showErrorMessage('Cannot declare riichi - hand is not tenpai!');
            return;
        }
        
        this.engine.isRiichi = true;
        this.showSuccessMessage('Riichi declared! 🚀');
        this.performAnalysis(true);
    }

    async loadPracticeScenario(scenarioType) {
        this.showLoadingState();
        
        try {
            // Load specific scenario hand
            this.currentHand = this.createScenarioHand(scenarioType);
            this.selectedTiles.clear();
            
            // Update display
            this.renderHand();
            this.renderWall();
            
            // Show scenario-specific guidance
            this.showScenarioGuidance(scenarioType);
            
            // Perform analysis
            await this.performAnalysis(true);
            
            this.showSuccessMessage(`Loaded ${this.formatScenarioName(scenarioType)} scenario! 🎯`);
            
        } catch (error) {
            console.error('Error loading scenario:', error);
            this.showErrorMessage('Failed to load practice scenario. Please try again.');
        } finally {
            this.hideLoadingState();
        }
    }

    showScenarioGuidance(scenarioType) {
        const guidance = {
            'iishanten': 'Focus on tile efficiency and multiple wait patterns. Look for the discard that gives you the most acceptance tiles.',
            'riichi_decision': 'Analyze whether to declare riichi or stay damaten. Consider your hand value, wait quality, and game situation.',
            'defensive': 'Practice reading dangerous tiles and selecting safe discards. Pay attention to opponents\' discards and calls.',
            'yaku_building': 'Work on building multiple yaku combinations. Consider which yaku paths are most achievable.',
            'efficiency_test': 'Test your knowledge of tile efficiency. Choose the discard that maximizes your chances.',
            'complex_wait_patterns': 'Study complex wait patterns and their relative values. Understanding waits is crucial for advanced play.'
        };
        
        const message = guidance[scenarioType] || 'Practice this scenario to improve your Mahjong skills!';
        this.showMessage(message, 'info');
    }

    formatScenarioName(scenarioType) {
        const names = {
            'iishanten': '1-Shanten Mastery',
            'riichi_decision': 'Riichi Decision',
            'defensive': 'Defensive Play',
            'yaku_building': 'Yaku Building',
            'efficiency_test': 'Efficiency Test',
            'complex_wait_patterns': 'Complex Wait Patterns'
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
            'riichi': 'Riichi',
            'menzen_tsumo': 'Menzen Tsumo',
            'ippatsu': 'Ippatsu',
            'tanyao': 'Tanyao',
            'pinfu': 'Pinfu',
            'iipeikou': 'Iipeikou',
            'yakuhai_dragon': 'Dragon',
            'yakuhai_seat': 'Seat Wind',
            'yakuhai_round': 'Round Wind',
            'sanshoku_doujun': 'Sanshoku',
            'ittsu': 'Ittsu',
            'chanta': 'Chanta',
            'chitoitsu': 'Chitoitsu',
            'toitoi': 'Toitoi',
            'sanankou': 'Sanankou',
            'honitsu': 'Honitsu',
            'chinitsu': 'Chinitsu'
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
            this.showErrorMessage('No recommendation available');
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

        let content = '<h4>🔬 Comprehensive Hand Analysis</h4>';
        
        // Hand Status
        content += '<h5>📋 Hand Status:</h5>';
        content += `<p><strong>Shanten:</strong> ${analysis.shanten !== undefined ? analysis.shanten : 'Calculating...'}</p>`;
        content += `<p><strong>Ukeire:</strong> ${analysis.ukeire !== undefined ? analysis.ukeire : 0} acceptance tiles</p>`;
        
        if (analysis.waits && analysis.waits.length > 0) {
            content += `<p><strong>Waiting for:</strong> ${analysis.waits.map(tile => this.formatTileText(tile)).join(', ')}</p>`;
        }
        
        if (analysis.completedYaku && analysis.completedYaku.length > 0) {
            content += '<h5>✅ Completed Yaku:</h5><ul>';
            analysis.completedYaku.forEach(yaku => {
                content += `<li><strong>${this.formatYakuName(yaku.name)}</strong> (${yaku.han}H) - ${(yaku.probability * 100).toFixed(1)}%</li>`;
            });
            content += '</ul>';
        }

        if (analysis.potentialYaku && analysis.potentialYaku.length > 0) {
            content += '<h5>🎯 Potential Yaku:</h5><ul>';
            analysis.potentialYaku.forEach(yaku => {
                content += `<li><strong>${this.formatYakuName(yaku.name)}</strong> (${yaku.han}H) - ${(yaku.probability * 100).toFixed(1)}%</li>`;
            });
            content += '</ul>';
        }

        if (!analysis.completedYaku?.length && !analysis.potentialYaku?.length) {
            content += '<p><em>No yaku detected. Focus on building basic patterns like sequences and pairs.</em></p>';
        }

        content += `<h5>📊 Statistics:</h5>`;
        content += `<p><strong>Expected Value:</strong> ${analysis.expectedValue || 0} points</p>`;
        content += `<p><strong>Win Probability:</strong> ${((analysis.winProbability || 0) * 100).toFixed(1)}%</p>`;
        content += `<p><strong>Deal-in Risk:</strong> ${((analysis.dealInRisk || 0) * 100).toFixed(1)}%</p>`;

        modalContent.innerHTML = content;
        document.getElementById('analysisModal').style.display = 'block';
    }
    
    showAnalysisError() { 
        this.showErrorMessage('Analysis failed. Please try again.'); 
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
window.onclick = function(event) {
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