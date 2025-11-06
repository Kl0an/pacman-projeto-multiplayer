// Função auto-executável (IIFE) que conserta a API de Áudio no iOS (Safari).
// O iOS não deixa o navegador tocar som antes do usuário interagir (tocar na tela).
(function () {
    // Garante compatibilidade entre navegadores para a API de Áudio.
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (window.AudioContext) {
        window.audioContext = new window.AudioContext();
    }
    
    // Esta função será chamada no PRIMEIRO toque do usuário.
    var fixAudioContext = function (e) {
        if (window.audioContext) {
            // Cria um "buffer" de som vazio e silencioso.
            var buffer = window.audioContext.createBuffer(1, 1, 22050);
            var source = window.audioContext.createBufferSource();
            source.buffer = buffer;
            // Conecta o som (silencioso) aos alto-falantes.
            source.connect(window.audioContext.destination);
            // Toca o som silencioso.
            if (source.start) {
                source.start(0);
            } else if (source.play) {
                source.play(0);
            } else if (source.noteOn) {
                source.noteOn(0);
            }
        }
        // Remove os "escutadores" de evento para não rodar de novo.
        document.removeEventListener('touchstart', fixAudioContext);
        document.removeEventListener('touchend', fixAudioContext);
    };
    // Adiciona os "escutadores" para o primeiro toque na tela.
    document.addEventListener('touchstart', fixAudioContext);
    document.addEventListener('touchend', fixAudioContext);
})();

// --- Funções de Áudio (Legado/Safari) ---
// Estas são funções globais que o código usa para compatibilidade com o Safari.
var ambS; // Variável global para o som de ambiente (sirene)

// Toca um som (ex: 'game_start.mp3')
function playSound(sound) {
    var path = 'app/style/audio/' + sound + '.mp3';
    var context = window.audioContext;
    var request = new XMLHttpRequest();
    console.log('Playing ' + path);
    request.open('GET', path, true);
    request.responseType = 'arraybuffer';
    request.addEventListener('load', function (e) {
        context.decodeAudioData(this.response, function (buffer) {
            var source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
        });
    }, false);
    request.send();
}
// Toca um som em loop (ex: a sirene)
function playSoundLoop(sound) {
    var path = 'app/style/audio/' + sound + '.mp3';
    var context = window.audioContext;
    var request = new XMLHttpRequest();
    console.log('Playing Loop ' + path);
    request.open('GET', path, true);
    request.responseType = 'arraybuffer';
    request.addEventListener('load', function (e) {
        context.decodeAudioData(this.response, function (buffer) {
            var source = context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(context.destination);
            source.start(0);
        });
    }, false);
    request.send();
}

// Para um som em loop (não usado no código final, mas existe)
function stopSoundLoop(sound) {
    var path = 'app/style/audio/' + sound + '.mp3';
    var context = window.audioContext;
    var request = new XMLHttpRequest();
    console.log('Playing Loop ' + path);
    request.open('GET', path, true);
    request.responseType = 'arraybuffer';
    request.addEventListener('load', function (e) {
        context.decodeAudioData(this.response, function (buffer) {
            var source = context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(context.destination);
            source.stop(0);
        });
    }, false);
    request.send();
}


// --- Funções de Controle de Eventos (Toque na Tela) ---

// Previne o menu de "clique longo" que aparece em celulares (ex: salvar imagem)
function absorbEvent_(event) {
    var e = event || window.event;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
    e.cancelBubble = true;
    e.returnValue = false;
    return false;
}

function preventLongPressMenu(node) {
    node.ontouchstart = absorbEvent_;
    node.ontouchmove = absorbEvent_;
    node.ontouchend = absorbEvent_;
    node.ontouchcancel = absorbEvent_;
}
// Checa se o navegador é o Safari (para usar as funções de som especiais)
function isSafari() {
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('safari') != -1 && 
            ( ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('ipod') > -1 ) ) {
        if (ua.indexOf('chrome') > -1) {
            return false; // É o Chrome no iOS, não o Safari
        } else {
            return true; // É o Safari
        }
    }
    return false;
}

// =================================================================================
// CLASSE DO FANTASMA (Ghost)
// Controla a IA, movimento e aparência de cada fantasma
// =================================================================================
class Ghost {
    /**
     * O "construtor" é o que cria o objeto. Ele define as propriedades iniciais.
     * @param {number} scaledTileSize - O tamanho de cada "bloco" do labirinto em pixels.
     * @param {Array} mazeArray - O mapa (array de 'X' e 'o').
     * @param {Object} pacman - A referência ao objeto do Pacman (para persegui-lo).
     * @param {string} name - O nome do fantasma ('blinky', 'pinky', 'inky', 'clyde').
     * @param {number} level - O nível atual do jogo (afeta a velocidade).
     * @param {Object} characterUtil - Funções úteis de movimento.
     * @param {Object} blinky - Referência ao Blinky (necessário para a IA do Inky).
     */
    constructor(
            scaledTileSize, mazeArray, pacman, name, level, characterUtil, blinky,
            ) {
        this.scaledTileSize = scaledTileSize;
        this.mazeArray = mazeArray;
        this.pacman = pacman;
        this.name = name;
        this.level = level;
        this.characterUtil = characterUtil;
        this.blinky = blinky;
        this.animationTarget = document.getElementById(name); // A div <p> do fantasma no HTML

        this.reset(); // Chama a função para definir o estado inicial
    }

    /**
     * Reseta o fantasma para a posição e estado inicial (usado no início e a cada morte).
     * @param {boolean} fullGameReset - Se true, reseta a velocidade (usado ao "Voltar ao Menu").
     */
    reset(fullGameReset) {
        if (fullGameReset) {
            delete this.defaultSpeed;
            delete this.cruiseElroy; // "Cruise Elroy" é o modo "raivoso" do Blinky
        }

        this.setDefaultMode(); // Define o modo de IA (começa em 'scatter')
        this.setMovementStats(this.pacman, this.name, this.level); // Define as velocidades
        this.setSpriteAnimationStats(); // Define as animações (sprites)
        this.setStyleMeasurements(this.scaledTileSize, this.spriteFrames); // Define o tamanho (CSS)
        this.setDefaultPosition(this.scaledTileSize, this.name); // Põe ele na "casa"
        this.setSpriteSheet(this.name, this.direction, this.mode); // Define a imagem correta
    }
/** * Define o modo padrão (começa em 'scatter' - dispersar).
     * O Blinky (vermelho) é o único que começa fora da "casa".
     */
    setDefaultMode() {
        this.allowCollision = true;
        this.defaultMode = 'scatter'; // Modo padrão (ir para o canto)
        this.mode = 'scatter';
        if (this.name !== 'blinky') {
            this.idleMode = 'idle'; // 'idle' = preso na "casa" dos fantasmas
        }
    }

    /** * Define as velocidades do fantasma (baseado na velocidade do Pacman).
     * Eles ficam mais rápidos a cada nível (levelAdjustment).
     */
    setMovementStats(pacman, name, level) {
        const pacmanSpeed = pacman.velocityPerMs;
        const levelAdjustment = level / 100; // A cada nível, 1% mais rápido

        // Diferentes velocidades para diferentes situações
        this.slowSpeed = pacmanSpeed * (0.75 + levelAdjustment);
        this.mediumSpeed = pacmanSpeed * (0.875 + levelAdjustment); // "Cruise Elroy" 1
        this.fastSpeed = pacmanSpeed * (1 + levelAdjustment);     // "Cruise Elroy" 2

        if (!this.defaultSpeed) {
            this.defaultSpeed = this.slowSpeed;
        }

        this.scaredSpeed = pacmanSpeed * 0.5;       // Lento quando assustado (azul)
        this.transitionSpeed = pacmanSpeed * 0.4; // Lento no túnel
        this.eyeSpeed = pacmanSpeed * 2;          // Rápido quando é só "olhos"

        this.velocityPerMs = this.defaultSpeed;
        this.moving = false; // Começa parado

        // Define a direção inicial de cada fantasma
        switch (name) {
            case 'blinky':
                this.defaultDirection = this.characterUtil.directions.left;
                break;
            case 'pinky':
                this.defaultDirection = this.characterUtil.directions.down;
                break;
            case 'inky':
                this.defaultDirection = this.characterUtil.directions.up;
                break;
            case 'clyde':
                this.defaultDirection = this.characterUtil.directions.up;
                break;
            default:
                this.defaultDirection = this.characterUtil.directions.left;
                break;
        }
        this.direction = this.defaultDirection;
    }
/** Define as variáveis de animação do sprite sheet */
    setSpriteAnimationStats() {
        this.display = true; // Se o fantasma está visível
        this.loopAnimation = true; // Se a animação (ex: "nadando") deve repetir
        this.animate = true; // Se a animação está ativa
        this.msBetweenSprites = 250; // Tempo entre "frames" da animação
        this.msSinceLastSprite = 0;
        this.spriteFrames = 2; // Fantasmas só têm 2 frames (nadando)
        this.backgroundOffsetPixels = 0;
        this.animationTarget.style.backgroundPosition = '0px 0px';
    }

    /**
     * Define as propriedades CSS do fantasma (tamanho em pixels).
     * @param {number} scaledTileSize - O tamanho do "bloco" em pixels.
     * @param {number} spriteFrames - Quantos frames a animação tem (são 2).
     */
    setStyleMeasurements(scaledTileSize, spriteFrames) {
        // Os fantasmas são um pouco maiores que 1 bloco (são 2x2 blocos no original,
        // mas o sprite aqui é de 2x o tamanho do bloco).
        this.measurement = scaledTileSize * 2;

        this.animationTarget.style.height = `${this.measurement}px`;
        this.animationTarget.style.width = `${this.measurement}px`;
        const bgSize = this.measurement * spriteFrames;
        // Define o tamanho total da imagem de sprite (ex: 2 frames = 88px se o frame for 44px)
        this.animationTarget.style.backgroundSize = `${bgSize}px`;
    }

    /**
     * Define a Posição Padrão de cada fantasma (na "casa" ou fora).
     */
    setDefaultPosition(scaledTileSize, name) {
        switch (name) {
            case 'blinky': // Blinky (Vermelho) começa fora da casa, já caçando.
                this.defaultPosition = {
                    top: scaledTileSize * 10.5,
                    left: scaledTileSize * 13,
                };
                break;
            case 'pinky': // Pinky (Rosa) começa dentro da casa, no meio.
                this.defaultPosition = {
                    top: scaledTileSize * 13.5,
                    left: scaledTileSize * 13,
                };
                break;
            case 'inky': // Inky (Azul) começa dentro da casa, à esquerda.
                this.defaultPosition = {
                    top: scaledTileSize * 13.5,
                    left: scaledTileSize * 11,
                };
                break;
            case 'clyde': // Clyde (Laranja) começa dentro da casa, à direita.
                this.defaultPosition = {
                    top: scaledTileSize * 13.5,
                    left: scaledTileSize * 15,
                };
                break;
            default:
                this.defaultPosition = { top: 0, left: 0 };
                break;
        }
        this.position = Object.assign({}, this.defaultPosition);
        this.oldPosition = Object.assign({}, this.position);
        // Atualiza a posição CSS no HTML
        this.animationTarget.style.top = `${this.position.top}px`;
        this.animationTarget.style.left = `${this.position.left}px`;
    }
/**
     * Escolhe qual imagem (sprite sheet) o fantasma deve usar.
     * @param {string} name - Nome do fantasma
     * @param {string} direction - 'up', 'down', 'left', 'right'
     * @param {string} mode - 'scared' (assustado), 'eyes' (olhos), 'chase' (caçando), 'scatter' (disperso)
     */
    setSpriteSheet(name, direction, mode) {
        let emotion = '';
        // "Cruise Elroy" (modo raivoso do Blinky) usa sprites diferentes
        if (this.defaultSpeed !== this.slowSpeed) {
            emotion = (this.defaultSpeed === this.mediumSpeed)
                    ? '_annoyed' : '_angry';
        }

        if (mode === 'scared') {
            // Sprite azul/branco piscando
            this.animationTarget.style.backgroundImage = 'url(app/style/graphics/'
                    + `spriteSheets/characters/ghosts/scared_${this.scaredColor}.svg)`;
        } else if (mode === 'eyes') {
            // Sprite "só os olhos" (quando comido)
            this.animationTarget.style.backgroundImage = 'url(app/style/graphics/'
                    + `spriteSheets/characters/ghosts/eyes_${direction}.svg)`;
        } else {
            // Sprite normal (colorido)
            this.animationTarget.style.backgroundImage = 'url(app/style/graphics/'
                    + `spriteSheets/characters/ghosts/${name}/${name}_${direction}`
                    + `${emotion}.svg)`;
        }
    }

    /** Verifica se o fantasma está nos túneis laterais (onde ele fica mais lento) */
    isInTunnel(gridPosition) {
        return (
                gridPosition.y === 14
                && (gridPosition.x < 6 || gridPosition.x > 21)
                );
    }

    /** Verifica se o fantasma está dentro da "casa" central */
    isInGhostHouse(gridPosition) {
        return (
                (gridPosition.x > 9 && gridPosition.x < 18)
                && (gridPosition.y > 11 && gridPosition.y < 17)
                );
    }
/**
     * Verifica se um "bloco" (tile) no mapa é um caminho válido (não é uma parede 'X').
     * @param {Array} mazeArray - O mapa
     * @param {number} y - Posição Y (linha)
     * @param {number} x - Posição X (coluna)
     * @returns {Object|boolean} - Retorna a {coordenada} se for válido, ou 'false' se for parede.
     */
    getTile(mazeArray, y, x) {
        let tile = false;

        // Checa se a coordenada [y][x] existe e NÃO é uma parede 'X'
        if (mazeArray[y] && mazeArray[y][x] && mazeArray[y][x] !== 'X') {
            tile = {
                x,
                y,
            };
        }

        return tile;
    }

    /**
     * Retorna uma lista de movimentos possíveis (não pode ser parede, não pode virar 180°).
     * Esta é a base da IA: "Para onde eu POSSO ir?"
     * @param {Object} gridPosition - Posição atual {x, y}
     * @param {string} direction - Direção atual ('up', 'down', etc.)
     * @param {Array} mazeArray - O mapa
     * @returns {Object} - Um objeto com as direções válidas (ex: { up: true, left: true })
     */
    determinePossibleMoves(gridPosition, direction, mazeArray) {
        const {x, y} = gridPosition;

        // Checa os 4 lados
        const possibleMoves = {
            up: this.getTile(mazeArray, y - 1, x),
            down: this.getTile(mazeArray, y + 1, x),
            left: this.getTile(mazeArray, y, x - 1),
            right: this.getTile(mazeArray, y, x + 1),
        };

        // REGRA IMPORTANTE: Fantasmas não podem dar meia-volta (virar 180°)
        // a menos que mudem de modo (ex: de 'chase' para 'scared').
        possibleMoves[this.characterUtil.getOppositeDirection(direction)] = false;

        // Limpa os movimentos inválidos (paredes ou o caminho para trás)
        Object.keys(possibleMoves).forEach((tile) => {
            if (possibleMoves[tile] === false) {
                delete possibleMoves[tile];
            }
        });

        return possibleMoves;
    }

    /**
     * Usa o Teorema de Pitágoras para calcular a distância (em linha reta) até um alvo.
     * Usado pela IA para decidir qual caminho é o mais curto.
     */
    calculateDistance(position, pacman) {
        return Math.sqrt(
                ((position.x - pacman.x) ** 2) + ((position.y - pacman.y) ** 2),
                );
    }
/** * Pega o "bloco" que está X espaços à frente do Pac-Man,
     * baseado na direção que o Pac-Man está olhando.
     */
    getPositionInFrontOfPacman(pacmanGridPosition, spaces) {
        const target = Object.assign({}, pacmanGridPosition);
        const pacDirection = this.pacman.direction;
        
        // Se Pacman está indo Cima/Baixo, muda o Y. Se Esq/Dir, muda o X.
        const propToChange = (pacDirection === 'up' || pacDirection === 'down')
                ? 'y' : 'x';
        // Se for Cima/Esquerda (negativo) ou Baixo/Direita (positivo)
        const tileOffset = (pacDirection === 'up' || pacDirection === 'left')
                ? (spaces * -1) : spaces;
        
        target[propToChange] += tileOffset;
        return target;
    }

    /** * IA do Pinky (Rosa): Tenta emboscar o Pac-Man.
     * O alvo dele é 4 blocos À FRENTE da direção do Pac-Man.
     */
    determinePinkyTarget(pacmanGridPosition) {
        return this.getPositionInFrontOfPacman(
                pacmanGridPosition, 4,
                );
    }

    /**
     * IA do Inky (Azul): O mais complexo, tenta flanquear.
     * 1. Pega um "pivô" 2 blocos à frente do Pacman.
     * 2. Pega a posição do Blinky (Vermelho).
     * 3. O alvo do Inky é o "reflexo" do Blinky através desse pivô.
     * (Veja a imagem inky_target.png na pasta 'references' que você baixou)
     */
    determineInkyTarget(pacmanGridPosition) {
        const blinkyGridPosition = this.characterUtil.determineGridPosition(
                this.blinky.position, this.scaledTileSize,
                );
        const pivotPoint = this.getPositionInFrontOfPacman(
                pacmanGridPosition, 2,
                );
        
        // Calcula o "vetor" do Blinky ao pivô e o "espelha"
        return {
            x: pivotPoint.x + (pivotPoint.x - blinkyGridPosition.x),
            y: pivotPoint.y + (pivotPoint.y - blinkyGridPosition.y),
        };
    }

    /**
     * IA do Clyde (Laranja): O "medroso".
     * 1. Se ele está a mais de 8 blocos de distância, ele persegue o Pac-Man (como o Blinky).
     * 2. Se ele chega a 8 blocos ou menos, ele "se assusta" e foge
     * para o canto inferior esquerdo do mapa (seu modo 'scatter').
     */
    determineClydeTarget(gridPosition, pacmanGridPosition) {
        const distance = this.calculateDistance(gridPosition, pacmanGridPosition);
        return (distance > 8) ? pacmanGridPosition : {x: 0, y: 30}; // {x: 0, y: 30} é o canto inferior esquerdo
    }
/**
     * A "Inteligência Artificial" principal. Decide QUAL bloco o fantasma deve perseguir,
     * baseado no seu modo atual ('chase', 'scatter', 'scared', 'eyes').
     * @param {string} name - Nome do fantasma ('blinky', etc.)
     * @param {Object} gridPosition - Posição atual do fantasma {x, y}
     * @param {Object} pacmanGridPosition - Posição atual do Pacman {x, y}
     * @param {string} mode - Modo atual ('chase', 'scatter', etc.)
     * @returns {Object} - A coordenada {x, y} do alvo.
     */
    getTarget(name, gridPosition, pacmanGridPosition, mode) {
        
        // MODO 1: "Olhos" (Comido)
        // O alvo é a entrada da "casa" dos fantasmas.
        if (mode === 'eyes') {
            return {x: 13.5, y: 10};
        }

        // MODO 2: "Assustado" (Azul)
        // O alvo é o Pacman, mas a lógica de movimento (determineBestMove)
        // vai escolher o caminho MAIS LONGE dele.
        if (mode === 'scared') {
            return pacmanGridPosition;
        }

        // MODO 3: "Disperso" (Scatter)
        // O alvo é o seu "canto" pessoal do labirinto.
        if (mode === 'scatter') {
            switch (name) {
                case 'blinky': // Canto superior direito
                    // Se o Blinky estiver no modo "Cruise Elroy" (raivoso), ele NUNCA dispersa.
                    return (this.cruiseElroy ? pacmanGridPosition : {x: 27, y: 0});
                case 'pinky': // Canto superior esquerdo
                    return {x: 0, y: 0};
                case 'inky': // Canto inferior direito
                    return {x: 27, y: 30};
                case 'clyde': // Canto inferior esquerdo
                    return {x: 0, y: 30};
                default:
                    return {x: 0, y: 0};
            }
        }

        // MODO 4: "Perseguindo" (Chase)
        // Cada fantasma usa sua IA única.
        switch (name) {
            case 'blinky': // Persegue o Pacman diretamente.
                return pacmanGridPosition;
            case 'pinky': // Persegue 4 blocos à frente do Pacman.
                return this.determinePinkyTarget(pacmanGridPosition);
            case 'inky': // Lógica complexa de flanquear.
                return this.determineInkyTarget(pacmanGridPosition);
            case 'clyde': // Persegue ou foge, dependendo da distância.
                return this.determineClydeTarget(gridPosition, pacmanGridPosition);
            default:
                // Fantasma desconhecido (nunca acontece)
                return pacmanGridPosition;
        }
    }
/**
     * Pega a lista de movimentos possíveis e o alvo, e decide qual movimento
     * deixa o fantasma mais perto (ou mais longe, se assustado) do alvo.
     * @returns {string} - A melhor direção ('up', 'down', 'left', 'right')
     */
    determineBestMove(
            name, possibleMoves, gridPosition, pacmanGridPosition, mode,
            ) {
        let bestDistance = (mode === 'scared') ? 0 : Infinity; // Se assustado, quer a maior distância (0)
        let bestMove;
        // Pega o alvo (ex: a posição do Pacman, ou o canto do mapa)
        const target = this.getTarget(name, gridPosition, pacmanGridPosition, mode);

        // Testa cada movimento possível (ex: 'up', 'left')
        Object.keys(possibleMoves).forEach((move) => {
            // Calcula a distância do *próximo* bloco até o alvo
            const distance = this.calculateDistance(
                    possibleMoves[move], target,
                    );
            
            // Se assustado, procura a MAIOR distância.
            // Se normal, procura a MENOR distância (Infinity).
            const betterMove = (mode === 'scared')
                    ? (distance > bestDistance)
                    : (distance < bestDistance);

            // Se esse movimento for melhor que o anterior, salva ele.
            if (betterMove) {
                bestDistance = distance;
                bestMove = move;
            }
        });

        return bestMove; // Retorna a melhor direção
    }

    /**
     * Função final da IA. Pega os movimentos possíveis e o melhor movimento
     * para decidir a direção final do fantasma.
     * @returns {string} - A direção final.
     */
    determineDirection(
            name, gridPosition, pacmanGridPosition, direction, mazeArray, mode,
            ) {
        let newDirection = direction;
        const possibleMoves = this.determinePossibleMoves(
                gridPosition, direction, mazeArray,
                );

        // Se SÓ TEM UM caminho (corredor), vá por ele.
        if (Object.keys(possibleMoves).length === 1) {
            [newDirection] = Object.keys(possibleMoves);
        } 
        // Se tem MAIS DE UM caminho (cruzamento), calcula o melhor.
        else if (Object.keys(possibleMoves).length > 1) {
            newDirection = this.determineBestMove(
                    name, possibleMoves, gridPosition, pacmanGridPosition, mode,
                    );
        }

        return newDirection;
    }
/**
     * Controla o movimento "ocioso" (idle) dos fantasmas presos na "casa".
     * Faz eles ficarem subindo e descendo.
     * @param {number} elapsedMs - Tempo desde o último frame.
     * @param {Object} position - Posição atual {x, y}.
     * @param {number} velocity - Velocidade atual.
     * @returns {Object} - A nova posição {top, left}.
     */
    handleIdleMovement(elapsedMs, position, velocity) {
        const newPosition = Object.assign({}, this.position);

        // Faz o fantasma "quicar" (inverte a direção)
        if (position.y <= 13.5) {
            this.direction = this.characterUtil.directions.down;
        } else if (position.y >= 14.5) {
            this.direction = this.characterUtil.directions.up;
        }

        // Se o fantasma foi liberado (modo 'leaving')
        if (this.idleMode === 'leaving') {
            // 1. Chegou na saída (em cima do portão)?
            if (position.x === 13.5 && (position.y > 10.8 && position.y < 11)) {
                this.idleMode = undefined; // Não está mais ocioso
                newPosition.top = this.scaledTileSize * 10.5; // Põe pra fora
                this.direction = this.characterUtil.directions.left; // Manda virar
                window.dispatchEvent(new Event('releaseGhost')); // Avisa o jogo para soltar o próximo
            } 
            // 2. Está alinhado com o centro (portão)?
            else if (position.x > 13.4 && position.x < 13.6) {
                newPosition.left = this.scaledTileSize * 13; // Centraliza
                this.direction = this.characterUtil.directions.up; // Manda subir
            } 
            // 3. Está na altura do centro (indo para o portão)?
            else if (position.y > 13.9 && position.y < 14.1) {
                newPosition.top = this.scaledTileSize * 13.5; // Trava na altura
                // Manda ir para o centro
                this.direction = (position.x < 13.5)
                        ? this.characterUtil.directions.right
                        : this.characterUtil.directions.left;
            }
        }

        // Aplica o movimento (para cima ou para baixo)
        newPosition[this.characterUtil.getPropertyToChange(this.direction)]
                += this.characterUtil.getVelocity(this.direction, velocity) * elapsedMs;

        return newPosition;
    }

    /**
     * Chamada pelo GameCoordinator para "libertar" o fantasma da casa.
     */
    endIdleMode() {
        this.idleMode = 'leaving';
    }
/**
     * Controla o movimento quando o fantasma está "alinhado" (snapped) com o grid.
     * É aqui que ele toma a decisão de qual direção seguir em um cruzamento.
     * @param {number} elapsedMs - Tempo desde o último frame.
     * @param {Object} gridPosition - Posição atual {x, y}.
     * @param {number} velocity - Velocidade atual.
     * @param {Object} pacmanGridPosition - Posição do Pacman {x, y}.
     * @returns {Object} - A nova posição {top, left}.
     */
    handleSnappedMovement(elapsedMs, gridPosition, velocity, pacmanGridPosition) {
        const newPosition = Object.assign({}, this.position);

        // ** A IA PRINCIPAL É CHAMADA AQUI! **
        // Decide a próxima direção (up, down, left, right)
        this.direction = this.determineDirection(
                this.name, gridPosition, pacmanGridPosition, this.direction,
                this.mazeArray, this.mode,
                );
        
        // Aplica o movimento na direção escolhida
        newPosition[this.characterUtil.getPropertyToChange(this.direction)]
                += this.characterUtil.getVelocity(this.direction, velocity) * elapsedMs;

        return newPosition;
    }

    /**
     * Verifica se um fantasma (só "olhos") chegou na porta da "casa".
     * @param {string} mode - Modo atual ('eyes').
     * @param {Object} position - Posição atual {x, y}.
     * @returns {boolean} - True se estiver na porta.
     */
    enteringGhostHouse(mode, position) {
        return (
                mode === 'eyes'
                && position.y === 11 // Na linha da porta
                && (position.x > 13.4 && position.x < 13.6) // Alinhado com a porta
                );
    }
/**
     * Verifica se os "olhos" chegaram ao centro da "casa" para "renascer".
     * @param {string} mode - Modo atual ('eyes').
     * @param {Object} position - Posição atual {x, y}.
     * @returns {boolean} - True se estiver no centro.
     */
    enteredGhostHouse(mode, position) {
        return (
                mode === 'eyes'
                && position.x === 13.5 // Alinhado no centro
                && (position.y > 13.8 && position.y < 14.2) // Na altura do centro
                );
    }

    /**
     * Verifica se um fantasma "renascido" (que não é mais 'eyes') está saindo da "casa".
     * @param {string} mode - Modo atual (ex: 'scatter').
     * @param {Object} position - Posição atual {x, y}.
     * @returns {boolean} - True se estiver na saída.
     */
    leavingGhostHouse(mode, position) {
        return (
                mode !== 'eyes'
                && position.x === 13.5 // Alinhado com a porta
                && (position.y > 10.8 && position.y < 11) // Na altura da porta
                );
    }

    /**
     * Controla a "coreografia" de entrar e sair da casa dos fantasmas.
     * Força o fantasma a seguir o caminho correto para entrar/sair.
     * @param {Object} gridPosition - Posição atual {x, y}.
     * @returns {Object} - A posição {x, y} corrigida (se necessário).
     */
    handleGhostHouse(gridPosition) {
        const gridPositionCopy = Object.assign({}, gridPosition);

        // Se os "olhos" chegaram na porta, força a direção para 'down' (baixo).
        if (this.enteringGhostHouse(this.mode, gridPosition)) {
            this.direction = this.characterUtil.directions.down;
            gridPositionCopy.x = 13.5; // Trava no eixo X
            this.position = this.characterUtil.snapToGrid(
                    gridPositionCopy, this.direction, this.scaledTileSize,
                    );
        }

        // Se os "olhos" chegaram no centro, força a direção para 'up' (cima) e "renasce".
        if (this.enteredGhostHouse(this.mode, gridPosition)) {
            this.direction = this.characterUtil.directions.up;
            gridPositionCopy.y = 14; // Trava no eixo Y
            this.position = this.characterUtil.snapToGrid(
                    gridPositionCopy, this.direction, this.scaledTileSize,
                    );
            this.mode = this.defaultMode; // Renasce (volta ao modo 'scatter' ou 'chase')
            window.dispatchEvent(new Event('restoreGhost')); // Avisa o jogo
        }

        // Se o fantasma "renascido" chegou na porta, força a direção para 'left' (esquerda).
        if (this.leavingGhostHouse(this.mode, gridPosition)) {
            gridPositionCopy.y = 11; // Trava no eixo Y (fora da casa)
            this.position = this.characterUtil.snapToGrid(
                    gridPositionCopy, this.direction, this.scaledTileSize,
                    );
            this.direction = this.characterUtil.directions.left;
        }

        return gridPositionCopy;
    }
/**
     * Controla o movimento quando o fantasma está "desalinhado" (entre blocos).
     * Ele apenas continua se movendo na direção atual até atingir o próximo bloco.
     * @param {number} elapsedMs - Tempo desde o último frame.
     * @param {Object} gridPosition - Posição atual {x, y}.
     * @param {number} velocity - Velocidade atual.
     * @returns {Object} - A nova posição {top, left}.
     */
    handleUnsnappedMovement(elapsedMs, gridPosition, velocity) {
        // Primeiro, verifica se o fantasma está entrando ou saindo da "casa"
        const gridPositionCopy = this.handleGhostHouse(gridPosition);

        // Calcula a posição exata (em pixels) para onde o fantasma quer ir
        const desired = this.characterUtil.determineNewPositions(
                this.position, this.direction, velocity, elapsedMs, this.scaledTileSize,
                );

        // Verifica se o fantasma está prestes a cruzar para um novo "bloco" do grid
        if (this.characterUtil.changingGridPosition(
                gridPositionCopy, desired.newGridPosition,
                )) {
            // Se sim, "trava" (snap) ele no bloco atual antes de decidir o próximo.
            // Isso garante que ele só tome decisões em cima de um bloco.
            return this.characterUtil.snapToGrid(
                    gridPositionCopy, this.direction, this.scaledTileSize,
                    );
        }

        // Se não, apenas continua se movendo (retorna a posição em pixels)
        return desired.newPosition;
    }

    /**
     * Função CHAVE de movimento, chamada a cada frame pelo GameEngine.
     * Decide qual lógica de movimento usar (ocioso, alinhado ou desalinhado).
     * @param {number} elapsedMs - Tempo desde o último frame.
     * @returns {Object} - A posição final {top, left}.
     */
    handleMovement(elapsedMs) {
        let newPosition;

        // 1. Descobre a posição atual no grid (ex: {x: 10.5, y: 11})
        const gridPosition = this.characterUtil.determineGridPosition(
                this.position, this.scaledTileSize,
                );
        const pacmanGridPosition = this.characterUtil.determineGridPosition(
                this.pacman.position, this.scaledTileSize,
                );
        
        // 2. Decide a velocidade (normal, assustado, túnel, olhos)
        const velocity = this.determineVelocity(
                gridPosition, this.mode,
                );

        // 3. Escolhe a lógica de movimento correta:
        if (this.idleMode) {
            // Lógica 1: Se está "preso" na casa (idle ou leaving).
            newPosition = this.handleIdleMovement(
                    elapsedMs, gridPosition, velocity,
                    );
        } else if (JSON.stringify(this.position) === JSON.stringify(
                // Lógica 2: Se está "alinhado" (snapped) no grid.
                this.characterUtil.snapToGrid(
                        gridPosition, this.direction, this.scaledTileSize,
                        ),
                )) {
            newPosition = this.handleSnappedMovement(
                    elapsedMs, gridPosition, velocity, pacmanGridPosition,
                    );
        } else {
            // Lógica 3: Se está "desalinhado" (entre blocos).
            newPosition = this.handleUnsnappedMovement(
                    elapsedMs, gridPosition, velocity,
                    );
        }

        // 4. Verifica se está no túnel (para "teleportar")
        newPosition = this.characterUtil.handleWarp(
                newPosition, this.scaledTileSize, this.mazeArray,
                );

        // 5. Verifica se colidiu com o Pacman
        this.checkCollision(gridPosition, pacmanGridPosition);

        return newPosition;
    }
/**
     * Muda o modo de IA do fantasma (de 'chase' para 'scatter' ou vice-versa).
     * @param {string} newMode - O novo modo ('chase' or 'scatter').
     */
    changeMode(newMode) {
        this.defaultMode = newMode;

        const gridPosition = this.characterUtil.determineGridPosition(
                this.position, this.scaledTileSize,
                );

        // Só inverte a direção se o fantasma não estiver assustado ou sendo comido
        if ((this.mode === 'chase' || this.mode === 'scatter')
                && !this.cruiseElroy) {
            this.mode = newMode;

            // Se não estiver na casa dos fantasmas, ele dá meia-volta (180°)
            if (!this.isInGhostHouse(gridPosition)) {
                this.direction = this.characterUtil.getOppositeDirection(
                        this.direction,
                        );
            }
        }
    }

    /**
     * Usado no modo "assustado" (scared) para piscar entre azul e branco.
     */
    toggleScaredColor() {
        this.scaredColor = (this.scaredColor === 'blue')
                ? 'white' : 'blue';
        this.setSpriteSheet(this.name, this.direction, this.mode);
    }

    /**
     * Chamado quando o Pacman come uma Pílula de Poder.
     * O fantasma fica "assustado" (scared).
     */
    becomeScared() {
        const gridPosition = this.characterUtil.determineGridPosition(
                this.position, this.scaledTileSize,
                );

        // Se o fantasma não foi comido (não é 'eyes')
        if (this.mode !== 'eyes') {
            // Se não estiver na casa E não estiver já assustado, ele dá meia-volta.
            if (!this.isInGhostHouse(gridPosition) && this.mode !== 'scared') {
                this.direction = this.characterUtil.getOppositeDirection(
                        this.direction,
                        );
            }
            this.mode = 'scared';
            this.scaredColor = 'blue'; // Começa azul
            this.setSpriteSheet(this.name, this.direction, this.mode); // Atualiza a imagem
        }
    }

    /**
     * Chamado quando o tempo da Pílula de Poder acaba.
     * O fantasma volta ao seu modo normal (chase ou scatter).
     */
    endScared() {
        this.mode = this.defaultMode;
        this.setSpriteSheet(this.name, this.direction, this.mode);
    }

    /**
     * Ativa o modo "Cruise Elroy" (modo raivoso) do Blinky.
     * Ele fica mais rápido quando restam poucas bolinhas.
     */
    speedUp() {
        this.cruiseElroy = true;

        if (this.defaultSpeed === this.slowSpeed) {
            this.defaultSpeed = this.mediumSpeed;
        } else if (this.defaultSpeed === this.mediumSpeed) {
            this.defaultSpeed = this.fastSpeed;
        }
    }
/**
     * Reseta a velocidade do Blinky (Cruise Elroy) para o padrão (lento).
     * Usado quando o Pacman morre ou passa de nível.
     */
    resetDefaultSpeed() {
        this.defaultSpeed = this.slowSpeed;
        this.cruiseElroy = false;
        this.setSpriteSheet(this.name, this.direction, this.mode);
    }

    /**
     * Define a flag de "pausado" (usado para congelar o fantasma por um momento).
     * @param {boolean} newValue - True para pausar, false para despausar.
     */
    pause(newValue) {
        this.paused = newValue;
    }

    /**
     * **FUNÇÃO DE COLISÃO IMPORTANTE**
     * Chamada a cada frame para checar se o fantasma tocou no Pacman.
     * @param {Object} position - Posição do fantasma {x, y}.
     * @param {Object} pacman - Posição do Pacman {x, y}.
     */
    checkCollision(position, pacman) {
        // Se a distância for menor que 1 (colidiram)
        // E o fantasma não for só "olhos"
        // E a colisão estiver permitida (evita colisões múltiplas)
        if (this.calculateDistance(position, pacman) < 1
                && this.mode !== 'eyes'
                && this.allowCollision) {
            
            // CASO 1: Fantasma está ASSUSTADO (azul)
            if (this.mode === 'scared') {
                // Pacman comeu o fantasma.
                window.dispatchEvent(new CustomEvent('eatGhost', {
                    detail: {
                        ghost: this,
                    },
                }));
                this.mode = 'eyes'; // Vira "olhos"
            } 
            // CASO 2: Fantasma NÃO está assustado
            else {
                // Pacman morre.
                // ** AQUI É ONDE O SEU QUIZ VAI COMEÇAR! **
                // Este evento chama a função 'deathSequence' no GameCoordinator.
                window.dispatchEvent(new Event('deathSequence'));
            }
        }
    }

    /**
     * Decide qual velocidade o fantasma deve ter AGORA.
     * @param {Object} position - Posição atual {x, y}.
     * @param {string} mode - Modo atual ('chase', 'scared', etc.).
     * @returns {number} - A velocidade em pixels/ms.
     */
    determineVelocity(position, mode) {
        if (mode === 'eyes') {
            return this.eyeSpeed; // Rápido
        }

        if (this.paused) {
            return 0; // Parado
        }

        // Se estiver no túnel ou na casa
        if (this.isInTunnel(position) || this.isInGhostHouse(position)) {
            return this.transitionSpeed; // Lento
        }

        if (mode === 'scared') {
            return this.scaredSpeed; // Lento
        }

        // Velocidade normal (lenta, média ou rápida, dependendo do Blinky)
        return this.defaultSpeed;
    }
/**
     * Atualiza o CSS (posição) do fantasma na tela.
     * Chamado a cada frame de renderização (pode ser > 60fps).
     * @param {number} interp - Fator de interpolação (para suavizar o movimento).
     */
    draw(interp) {
        // Calcula a posição "suave" entre o frame antigo e o frame atual
        const newTop = this.characterUtil.calculateNewDrawValue(
                interp, 'top', this.oldPosition, this.position,
                );
        const newLeft = this.characterUtil.calculateNewDrawValue(
                interp, 'left', this.oldPosition, this.position,
                );
        
        // Atualiza o CSS 'top' e 'left'
        this.animationTarget.style.top = `${newTop}px`;
        this.animationTarget.style.left = `${newLeft}px`;

        // Esconde o fantasma se ele "pular" muito (evita "stutter")
        this.animationTarget.style.visibility = this.display
                ? this.characterUtil.checkForStutter(this.position, this.oldPosition)
                : 'hidden';

        // Avança um frame da animação (ex: sprite 1 -> sprite 2)
        const updatedProperties = this.characterUtil.advanceSpriteSheet(this);
        this.msSinceLastSprite = updatedProperties.msSinceLastSprite;
        this.animationTarget = updatedProperties.animationTarget;
        this.backgroundOffsetPixels = updatedProperties.backgroundOffsetPixels;
    }

    /**
     * Atualiza a lógica do fantasma (posição, sprite, etc.).
     * Chamado a cada ciclo de lógica (definido pelo timestep, ex: 60fps).
     * @param {number} elapsedMs - Tempo desde o último update.
     */
    update(elapsedMs) {
        // Salva a posição antiga (para a interpolação do 'draw')
        this.oldPosition = Object.assign({}, this.position);

        if (this.moving) {
            // Calcula a nova posição lógica
            this.position = this.handleMovement(elapsedMs);
            // Define o sprite correto (direção, modo)
            this.setSpriteSheet(this.name, this.direction, this.mode);
            // Adiciona tempo ao contador da animação
            this.msSinceLastSprite += elapsedMs;
        }
    }
} // <-- FIM DA CLASSE GHOST
// =================================================================================
// CLASSE DO PACMAN
// Controla o movimento (jogador), animação e lógica do Pacman
// =================================================================================
class Pacman {
    /**
     * O "construtor" que cria o Pacman.
     * @param {number} scaledTileSize - O tamanho do "bloco" em pixels.
     * @param {Array} mazeArray - O mapa (array de 'X' e 'o').
     * @param {Object} characterUtil - Funções úteis de movimento.
     */
    constructor(scaledTileSize, mazeArray, characterUtil) {
        this.scaledTileSize = scaledTileSize;
        this.mazeArray = mazeArray;
        this.characterUtil = characterUtil;
        this.animationTarget = document.getElementById('pacman'); // O <p> do Pacman no HTML
        this.pacmanArrow = document.getElementById('pacman-arrow'); // A seta (não usada)

        this.reset(); // Define o estado inicial
    }

    /**
     * Reseta o Pacman para o estado inicial (usado no início e a cada morte).
     */
    reset() {
        this.setMovementStats(this.scaledTileSize); // Define velocidades
        this.setSpriteAnimationStats(); // Define animações
        this.setStyleMeasurements(this.scaledTileSize, this.spriteFrames); // Define tamanho (CSS)
        this.setDefaultPosition(this.scaledTileSize); // Põe na posição inicial
        this.setSpriteSheet(this.direction); // Define a imagem correta
        // Atualiza a seta (não usada)
        this.pacmanArrow.style.backgroundImage = 'url(app/style/graphics/'
                + `spriteSheets/characters/pacman/arrow_${this.direction}.svg)`;
    }

    /**
     * Define as propriedades de movimento do Pacman.
     * @param {number} scaledTileSize - O tamanho do "bloco" em pixels.
     */
    setMovementStats(scaledTileSize) {
        this.velocityPerMs = this.calculateVelocityPerMs(scaledTileSize); // Calcula a velocidade
        this.desiredDirection = this.characterUtil.directions.left; // Para onde ele QUER ir
        this.direction = this.characterUtil.directions.left; // Para onde ele ESTÁ indo
        this.moving = false; // Começa parado
    }

    /**
     * Define as variáveis de animação (abrir e fechar a boca).
     */
    setSpriteAnimationStats() {
        this.specialAnimation = false; // (Usado para a animação de morte)
        this.display = true;
        this.animate = true;
        this.loopAnimation = true;
        this.msBetweenSprites = 50; // Tempo rápido (abrir/fechar boca)
        this.msSinceLastSprite = 0;
        this.spriteFrames = 4; // Animação do Pacman tem 4 frames (fechado, abrindo, aberto, fechando)
        this.backgroundOffsetPixels = 0;
        this.animationTarget.style.backgroundPosition = '0px 0px';
    }
/**
     * Define o tamanho (CSS) do Pacman.
     * @param {number} scaledTileSize - O tamanho do "bloco" em pixels.
     * @param {number} spriteFrames - Número de frames (são 4).
     */
    setStyleMeasurements(scaledTileSize, spriteFrames) {
        this.measurement = scaledTileSize * 2; // Pacman (assim como fantasmas) tem 2 blocos.

        this.animationTarget.style.height = `${this.measurement}px`;
        this.animationTarget.style.width = `${this.measurement}px`;
        this.animationTarget.style.backgroundSize = `${
                this.measurement * spriteFrames
                }px`;

        // Define o tamanho da "seta" (que não usamos)
        this.pacmanArrow.style.height = `${this.measurement * 2}px`;
        this.pacmanArrow.style.width = `${this.measurement * 2}px`;
        this.pacmanArrow.style.backgroundSize = `${this.measurement * 2}px`;
    }

    /**
     * Define a posição inicial do Pacman no labirinto.
     * @param {number} scaledTileSize - O tamanho do "bloco" em pixels.
     */
    setDefaultPosition(scaledTileSize) {
        this.defaultPosition = {
            top: scaledTileSize * 22.5, // Linha 22.5
            left: scaledTileSize * 13,  // Coluna 13
        };
        this.position = Object.assign({}, this.defaultPosition);
        this.oldPosition = Object.assign({}, this.position);
        this.animationTarget.style.top = `${this.position.top}px`;
        this.animationTarget.style.left = `${this.position.left}px`;
    }

    /**
     * Calcula a velocidade do Pacman em pixels por milissegundo.
     * @param {number} scaledTileSize - O tamanho do "bloco" em pixels.
     */
    calculateVelocityPerMs(scaledTileSize) {
        // No jogo original, Pacman se movia a 11 blocos por segundo.
        const velocityPerSecond = scaledTileSize * 11;
        return velocityPerSecond / 1000; // Converte para milissegundos
    }

    /**
     * Define o sprite sheet correto (imagem) baseado na direção.
     * @param {string} direction - 'up', 'down', 'left', 'right'.
     */
    setSpriteSheet(direction) {
        this.animationTarget.style.backgroundImage = 'url(app/style/graphics/'
                + `spriteSheets/characters/pacman/pacman_${direction}.svg)`;
    }

    /**
     * Prepara a animação de morte do Pacman (o "fechamento").
     */
    prepDeathAnimation() {
        this.loopAnimation = false; // Animação não repete
        this.msBetweenSprites = 125; // Mais lenta
        this.spriteFrames = 12; // A animação de morte tem 12 frames
        this.specialAnimation = true;
        this.backgroundOffsetPixels = 0;
        const bgSize = this.measurement * this.spriteFrames;
        this.animationTarget.style.backgroundSize = `${bgSize}px`;
        this.animationTarget.style.backgroundImage = 'url(app/style/'
                + 'graphics/spriteSheets/characters/pacman/pacman_death.svg)';
        this.animationTarget.style.backgroundPosition = '0px 0px';
        this.pacmanArrow.style.backgroundImage = ''; // Esconde a seta
    }
/**
     * Chamada quando o jogador aperta uma tecla (ou o D-pad).
     * Atualiza a "direção desejada" (desiredDirection).
     * @param {string} newDirection - 'up', 'down', 'left', 'right'.
     * @param {boolean} startMoving - Se true, força o Pacman a começar a se mover.
     */
    changeDirection(newDirection, startMoving) {
        this.desiredDirection = newDirection;
        this.pacmanArrow.style.backgroundImage = 'url(app/style/graphics/'
                + `spriteSheets/characters/pacman/arrow_${this.desiredDirection}.svg)`;

        if (startMoving) {
            this.moving = true;
        }
    }

    /**
     * Atualiza a posição da "seta" (não usada).
     */
    updatePacmanArrowPosition(position, scaledTileSize) {
        this.pacmanArrow.style.top = `${position.top - scaledTileSize}px`;
        this.pacmanArrow.style.left = `${position.left - scaledTileSize}px`;
    }

    /**
     * Controla o movimento quando o Pacman está "alinhado" (snapped) com o grid.
     * É aqui que o jogo checa se o jogador pode virar.
     * @param {number} elapsedMs - Tempo desde o último frame.
     * @returns {Object} - A nova posição {top, left}.
     */
    handleSnappedMovement(elapsedMs) {
        // Calcula para onde o Pacman QUER ir
        const desired = this.characterUtil.determineNewPositions(
                this.position, this.desiredDirection, this.velocityPerMs,
                elapsedMs, this.scaledTileSize,
                );
        // Calcula para onde o Pacman ESTÁ indo (continuar reto)
        const alternate = this.characterUtil.determineNewPositions(
                this.position, this.direction, this.velocityPerMs,
                elapsedMs, this.scaledTileSize,
                );

        // CHECAGEM 1: O Pacman QUER virar, mas tem uma parede?
        if (this.characterUtil.checkForWallCollision(
                desired.newGridPosition, this.mazeArray, this.desiredDirection,
                )) {
            // CHECAGEM 2: Ok, ele não pode virar. Mas ele pode continuar reto?
            if (this.characterUtil.checkForWallCollision(
                    alternate.newGridPosition, this.mazeArray, this.direction,
                    )) {
                // Se também tem uma parede na frente, PARAR.
                this.moving = false;
                return this.position;
            }
            // Se não tem parede na frente, continuar reto.
            return alternate.newPosition;
        }
        
        // Se NÃO tem parede na direção desejada:
        this.direction = this.desiredDirection; // A direção atual vira a desejada
        this.setSpriteSheet(this.direction); // Atualiza a imagem (sprite)
        return desired.newPosition; // Move na nova direção
    }
/**
     * Controla o movimento quando o Pacman está "desalinhado" (entre blocos).
     * Ele apenas continua se movendo na direção atual.
     * @param {Object} gridPosition - Posição atual {x, y}.
     * @param {number} elapsedMs - Tempo desde o último frame.
     * @returns {Object} - A nova posição {top, left}.
     */
    handleUnsnappedMovement(gridPosition, elapsedMs) {
        // Calcula para onde o Pacman QUER ir
        const desired = this.characterUtil.determineNewPositions(
                this.position, this.desiredDirection, this.velocityPerMs,
                elapsedMs, this.scaledTileSize,
                );
        // Calcula para onde o Pacman ESTÁ indo (continuar reto)
        const alternate = this.characterUtil.determineNewPositions(
                this.position, this.direction, this.velocityPerMs,
                elapsedMs, this.scaledTileSize,
                );

        // CHECAGEM 1: O jogador apertou para "dar meia-volta" (ex: estava indo 'left', apertou 'right')?
        if (this.characterUtil.turningAround(
                this.direction, this.desiredDirection,
                )) {
            // Se sim, permite a meia-volta imediatamente (não precisa esperar o grid)
            this.direction = this.desiredDirection;
            this.setSpriteSheet(this.direction);
            return desired.newPosition;
        }

        // CHECAGEM 2: O movimento atual (continuar reto) vai fazer ele cruzar para um novo "bloco"?
        if (this.characterUtil.changingGridPosition(
                gridPosition, alternate.newGridPosition,
                )) {
            // Se sim, "trava" (snap) ele no bloco exato.
            // Isso garante que a função 'handleSnappedMovement' seja chamada no próximo frame.
            return this.characterUtil.snapToGrid(
                    gridPosition, this.direction, this.scaledTileSize,
                    );
        }
        
        // Se nenhuma das opções acima, apenas continue reto.
        return alternate.newPosition;
    }

    /**
     * Atualiza o CSS (posição) do Pacman na tela.
     * Chamado a cada frame de renderização (pode ser > 60fps).
     * @param {number} interp - Fator de interpolação (para suavizar o movimento).
     */
    draw(interp) {
        // Calcula a posição "suave" entre o frame antigo e o frame atual
        const newTop = this.characterUtil.calculateNewDrawValue(
                interp, 'top', this.oldPosition, this.position,
                );
        const newLeft = this.characterUtil.calculateNewDrawValue(
                interp, 'left', this.oldPosition, this.position,
                );
        
        // Atualiza o CSS 'top' e 'left'
        this.animationTarget.style.top = `${newTop}px`;
        this.animationTarget.style.left = `${newLeft}px`;

        // Esconde o Pacman se ele "pular" muito (evita "stutter")
        this.animationTarget.style.visibility = this.display
                ? this.characterUtil.checkForStutter(this.position, this.oldPosition)
                : 'hidden';
        this.pacmanArrow.style.visibility = this.animationTarget.style.visibility;

        // Atualiza a posição da "seta" (não usada)
        this.updatePacmanArrowPosition(this.position, this.scaledTileSize);

        // Avança um frame da animação (abrir/fechar a boca)
        const updatedProperties = this.characterUtil.advanceSpriteSheet(this);
        this.msSinceLastSprite = updatedProperties.msSinceLastSprite;
        this.animationTarget = updatedProperties.animationTarget;
        this.backgroundOffsetPixels = updatedProperties.backgroundOffsetPixels;
    }

    /**
     * Atualiza a lógica do Pacman (posição, animação).
     * Chamado a cada ciclo de lógica (definido pelo timestep, ex: 60fps).
     * @param {number} elapsedMs - Tempo desde o último update.
     */
    update(elapsedMs) {
        // Salva a posição antiga (para a interpolação do 'draw')
        this.oldPosition = Object.assign({}, this.position);

        if (this.moving) {
            const gridPosition = this.characterUtil.determineGridPosition(
                    this.position, this.scaledTileSize,
                    );

            // Verifica se está "alinhado" (snapped) ou "desalinhado" (unsnapped)
            if (JSON.stringify(this.position) === JSON.stringify(
                    this.characterUtil.snapToGrid(
                            gridPosition, this.direction, this.scaledTileSize,
                            ),
                    )) {
                // Se ALINHADO: pode tomar decisões (virar)
                this.position = this.handleSnappedMovement(elapsedMs);
            } else {
                // Se DESALINHADO: continua na direção atual
                this.position = this.handleUnsnappedMovement(gridPosition, elapsedMs);
            }

            // Verifica se está no túnel (para "teleportar")
            this.position = this.characterUtil.handleWarp(
                    this.position, this.scaledTileSize, this.mazeArray,
                    );
        }

        // Se o Pacman está se movendo OU na animação de morte, atualiza o sprite.
        if (this.moving || this.specialAnimation) {
            this.msSinceLastSprite += elapsedMs;
        }
    }
} // <-- FIM DA CLASSE PACMAN
// =================================================================================
// CLASSE DO COORDENADOR DO JOGO (GameCoordinator)
// Esta é a classe "CHEFE". Ela controla tudo: o menu, o placar,
// o início do jogo, a morte, e o loop principal.
// =================================================================================
class GameCoordinator {
    /**
     * O "construtor" que "monta" o jogo.
     * Pega todas as divs do HTML e prepara as variáveis iniciais.
     */
    constructor() {
        // Pega todas as divs do index.html pelo ID
        this.gameUiContainer = document.getElementById('game-ui-container'); // O seu contêiner!
        this.gameUi = document.getElementById('game-ui');
        this.rowTop = document.getElementById('row-top');
        this.mazeDiv = document.getElementById('maze');
        this.mazeImg = document.getElementById('maze-img');
        this.mazeCover = document.getElementById('maze-cover'); // Cobertura preta (usada na morte)
        this.pointsDisplay = document.getElementById('points-display');
        this.highScoreDisplay = document.getElementById('high-score-display');
        this.extraLivesDisplay = document.getElementById('extra-lives');
        this.fruitDisplay = document.getElementById('fruit-display');
        this.mainMenu = document.getElementById('main-menu-container');
        this.gameStartButton = document.getElementById('game-start');
        this.pauseButton = document.getElementById('pause-button');
        this.soundButton = document.getElementById('sound-button');
        this.leftCover = document.getElementById('left-cover');     // Cortina amarela da esquerda
        this.rightCover = document.getElementById('right-cover');    // Cortina amarela da direita
        this.pausedText = document.getElementById('paused-text');
        this.bottomRow = document.getElementById('bottom-row');
        this.movementButtons = document.getElementById('movement-buttons'); // D-Pad do celular

        this.maxFps = 120; // FPS máximo desejado
        this.tileSize = 4; // Tamanho base (pixels) de um "bloco"
        
        // ** IMPORTANTE: O Jogo se auto-ajusta ao tamanho da tela **
        this.scale = this.determineScale(3); // Calcula a melhor escala (zoom)
        this.scaledTileSize = this.tileSize * this.scale; // Tamanho final do "bloco"
        this.firstGame = true; // Flag para saber se é a primeira vez rodando
        console.log('scale', this.scaledTileSize, this.scale); // Log no console (F12)

        // Mapeia as teclas do teclado para direções
        this.movementKeys = {
            // WASD
            87: 'up',
            83: 'down',
            65: 'left',
            68: 'right',

            // Setas
            38: 'up',
            40: 'down',
            37: 'left',
            39: 'right',
        };

        // Pontuação de cada fruta (baseado no nível)
        this.fruitPoints = {
            1: 100, // Nível 1: Cereja
            2: 300, // Nível 2: Morango
            3: 500, // Nível 3: Laranja
            4: 700, // Nível 4: Maçã
            5: 1000, // Nível 5: Melão
            6: 2000, // Nível 6: Galaxian
            7: 3000, // Nível 7: Sino
            8: 5000, // Nível 8+: Chave
        };
// A "matriz" (Array) que define o labirinto.
        // 'X' = Parede
        // 'o' = Bolinha (Pac-Dot)
        // 'O' = Pílula de Poder (Power Pellet)
        // ' ' = Espaço vazio (ex: túnel, casa dos fantasmas)
        // PARA CRIAR NOVOS MAPAS: Você precisa criar uma nova array desta.
        this.mazeArray = [
            ['XXXXXXXXXXXXXXXXXXXXXXXXXXXX'],
            ['XooooooooooooXXooooooooooooX'],
            ['XoXXXXoXXXXXoXXoXXXXXoXXXXoX'],
            ['XOXXXXoXXXXXoXXoXXXXXoXXXXOX'],
            ['XoXXXXoXXXXXoXXoXXXXXoXXXXoX'],
            ['XooooooooooooooooooooooooooX'],
            ['XoXXXXoXXoXXXXXXXXoXXoXXXXoX'],
            ['XoXXXXoXXoXXXXXXXXoXXoXXXXoX'],
            ['XooooooXXooooXXooooXXooooooX'],
            ['XXXXXXoXXXXX XX XXXXXoXXXXXX'],
            ['XXXXXXoXXXXX XX XXXXXoXXXXXX'],
            ['XXXXXXoXX          XXoXXXXXX'],
            ['XXXXXXoXX XXXXXXXX XXoXXXXXX'],
            ['XXXXXXoXX X      X XXoXXXXXX'],
            ['      o   X      X   o      '], // O Túnel
            ['XXXXXXoXX X      X XXoXXXXXX'],
            ['XXXXXXoXX XXXXXXXX XXoXXXXXX'],
            ['XXXXXXoXX          XXoXXXXXX'],
            ['XXXXXXoXX XXXXXXXX XXoXXXXXX'],
            ['XXXXXXoXX XXXXXXXX XXoXXXXXX'],
            ['XooooooooooooXXooooooooooooX'],
            ['XoXXXXoXXXXXoXXoXXXXXoXXXXoX'],
            ['XoXXXXoXXXXXoXXoXXXXXoXXXXoX'],
            ['XOooXXooooooo  oooooooXXooOX'],
            ['XXXoXXoXXoXXXXXXXXoXXoXXoXXX'],
            ['XXXoXXoXXoXXXXXXXXoXXoXXoXXX'],
            ['XooooooXXooooXXooooXXooooooX'],
            ['XoXXXXXXXXXXoXXoXXXXXXXXXXoX'],
            ['XoXXXXXXXXXXoXXoXXXXXXXXXXoX'],
            ['XooooooooooooooooooooooooooX'],
            ['XXXXXXXXXXXXXXXXXXXXXXXXXXXX'],
        ];

        // Converte a string do mapa em um array de caracteres (ex: 'XXX' -> ['X', 'X', 'X'])
        this.mazeArray.forEach((row, rowIndex) => {
            this.mazeArray[rowIndex] = row[0].split('');
        });

        // Adiciona os "escutadores" de clique nos botões
        this.gameStartButton.addEventListener(
                'click', this.startButtonClick.bind(this),
                );
        this.pauseButton.addEventListener(
                'click', this.handlePauseKey.bind(this),
                );
        this.soundButton.addEventListener(
                'click', this.soundButtonClick.bind(this),
                );

   
        // Esta parte é estranha: o JS insere o link do app.css na página...
         const head = document.getElementsByTagName('head')[0];
         const link = document.createElement('link');
         link.rel = 'stylesheet';
         link.href = 'build/app.css';

         // ...e SÓ DEPOIS que o CSS carregar, ele começa a pré-carregar os assets.
         link.onload = this.preloadAssets.bind(this);

         head.appendChild(link);

    
    } // <-- FIM DO CONSTRUCTOR

    /**
     * **FUNÇÃO MAIS IMPORTANTE PARA O LAYOUT**
     * Calcula o melhor "zoom" (escala) para o jogo caber na tela.
     * @param {Number} scale - A tentativa de escala atual (começa com 3).
     */
    determineScale(scale) {
        var buttonsH = 0; // Altura reservada para os botões do D-Pad
        
        // Se a tela está em pé (retrato), reserva 270px para os botões.
        if (window.innerHeight > window.innerWidth) {
            buttonsH = 270;
        }
        
        // Pega o menor tamanho de tela (altura) e subtrai os botões.
        const height = Math.min(
                document.documentElement.clientHeight, window.innerHeight || 0,
                ) - buttonsH;
        // Pega o menor tamanho de tela (largura).
        const width = Math.min(
                document.documentElement.clientWidth, window.innerWidth || 0,
                );
        
        const scaledTileSize = this.tileSize * scale;
        
        // Log para debug (aparece no F12)
        console.log('determineScale', scaledTileSize, scale, scaledTileSize * 28, width, scaledTileSize * 31, height);

        // Se o jogo (labirinto + placar) couber na tela...
        if ((scaledTileSize * 31) < height && (scaledTileSize * 28) < width) {
            // ...tenta um zoom maior (chama a si mesma com scale + 0.5)
            return this.determineScale(scale + 0.5);
        }

        // Se não couber, usa o zoom anterior (que é seguro).
        return scale - 1;
    }

    /**
     * Chamado quando o botão "PLAY" é clicado.
     */
    startButtonClick() {
        // Animação das "cortinas" amarelas abrindo
        this.leftCover.style.left = '-50%';
        this.rightCover.style.right = '-50%';
        this.mainMenu.style.opacity = 0; // Menu fica transparente
        this.gameStartButton.disabled = true; // Desativa o botão

        // Esconde o menu depois da animação
        setTimeout(() => {
            this.mainMenu.style.visibility = 'hidden';
        }, 1000);

        this.reset(); // Reseta o jogo (placar, vidas, etc.)
        if (this.firstGame) {
            this.firstGame = false;
            this.init(); // Inicia o "motor" do jogo (GameEngine)
        }
        this.startGameplay(true); // Começa o "Ready!"
    }

    /**
     * Chamado quando o botão de Som é clicado.
     */
    soundButtonClick() {
        const newVolume = this.soundManager.masterVolume === 1 ? 0 : 1; // Inverte (1 vira 0, 0 vira 1)
        this.soundManager.setMasterVolume(newVolume);
        localStorage.setItem('volumePreference', newVolume); // Salva a preferência
        this.setSoundButtonIcon(newVolume); // Muda o ícone (com ou sem 'X')
    }

    /**
     * Muda o ícone do botão de som (volume_off / volume_up).
     */
    setSoundButtonIcon(newVolume) {
        this.soundButton.innerHTML = newVolume === 0
                ? 'volume_off'
                : 'volume_up';
    }

    /**
     * Mostra a tela de "OOPS!" (a que você viu quando o 'galaxian.svg' faltou).
     */
    displayErrorMessage() {
        const loadingContainer = document.getElementById('loading-container');
        const errorMessage = document.getElementById('error-message');
        loadingContainer.style.opacity = 0;
        setTimeout(() => {
            loadingContainer.remove();
            errorMessage.style.opacity = 1;
            errorMessage.style.visibility = 'visible';
        }, 1500);
    }

    /**
     * Pré-carrega todas as imagens e sons antes de mostrar o menu "PLAY".
     * Isso garante que o jogo não "engasgue" durante o gameplay.
     */
    preloadAssets() {
        return new Promise((resolve) => {
            const loadingContainer = document.getElementById('loading-container');
            const loadingPacman = document.getElementById('loading-pacman');
            const loadingDotMask = document.getElementById('loading-dot-mask');

            // Lista Gigante de todas as imagens que o jogo precisa carregar.
            const imgBase = 'app/style/graphics/spriteSheets/';
            const imgSources = [
                // Pacman
                `${imgBase}characters/pacman/arrow_down.svg`,
                `${imgBase}characters/pacman/arrow_left.svg`,
                `${imgBase}characters/pacman/arrow_right.svg`,
                `${imgBase}characters/pacman/arrow_up.svg`,
                `${imgBase}characters/pacman/pacman_death.svg`,
                `${imgBase}characters/pacman/pacman_error.svg`,
                `${imgBase}characters/pacman/pacman_down.svg`,
                `${imgBase}characters/pacman/pacman_left.svg`,
                `${imgBase}characters/pacman/pacman_right.svg`,
                `${imgBase}characters/pacman/pacman_up.svg`,

                // Blinky
                `${imgBase}characters/ghosts/blinky/blinky_down_angry.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_down_annoyed.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_down.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_left_angry.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_left_annoyed.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_left.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_right_angry.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_right_annoyed.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_right.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_up_angry.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_up_annoyed.svg`,
                `${imgBase}characters/ghosts/blinky/blinky_up.svg`,

                // Clyde
                `${imgBase}characters/ghosts/clyde/clyde_down.svg`,
                `${imgBase}characters/ghosts/clyde/clyde_left.svg`,
                `${imgBase}characters/ghosts/clyde/clyde_right.svg`,
                `${imgBase}characters/ghosts/clyde/clyde_up.svg`,

                // Inky
                `${imgBase}characters/ghosts/inky/inky_down.svg`,
                `${imgBase}characters/ghosts/inky/inky_left.svg`,
                `${imgBase}characters/ghosts/inky/inky_right.svg`,
                `${imgBase}characters/ghosts/inky/inky_up.svg`,

                // Pinky
                `${imgBase}characters/ghosts/pinky/pinky_down.svg`,
                `${imgBase}characters/ghosts/pinky/pinky_left.svg`,
                `${imgBase}characters/ghosts/pinky/pinky_right.svg`,
                `${imgBase}characters/ghosts/pinky/pinky_up.svg`,

                // Fantasmas (Comum)
                `${imgBase}characters/ghosts/eyes_down.svg`,
                `${imgBase}characters/ghosts/eyes_left.svg`,
                `${imgBase}characters/ghosts/eyes_right.svg`,
                `${imgBase}characters/ghosts/eyes_up.svg`,
                `${imgBase}characters/ghosts/scared_blue.svg`,
                `${imgBase}characters/ghosts/scared_white.svg`,

                // Bolinhas (Pickups)
                `${imgBase}pickups/pacdot.svg`,
                `${imgBase}pickups/powerPellet.svg`,

                // Frutas
                `${imgBase}pickups/apple.svg`,
                `${imgBase}pickups/bell.svg`,
                `${imgBase}pickups/cherry.svg`,
                `${imgBase}pickups/galaxian.svg`,
                `${imgBase}pickups/key.svg`,
                `${imgBase}pickups/melon.svg`,
                `${imgBase}pickups/orange.svg`,
                `${imgBase}pickups/strawberry.svg`,

                // Texto
                `${imgBase}text/ready.svg`,
                `${imgBase}text/game_over.svg`, // <--- Faltou baixar este no .bat!

                // Pontos
                `${imgBase}text/100.svg`,
                `${imgBase}text/200.svg`,
                `${imgBase}text/300.svg`,
                `${imgBase}text/400.svg`,
                `${imgBase}text/500.svg`,
                `${imgBase}text/700.svg`,
                `${imgBase}text/800.svg`,
                `${imgBase}text/1000.svg`,
                `${imgBase}text/1600.svg`,
                `${imgBase}text/2000.svg`,
                `${imgBase}text/3000.svg`,
                `${imgBase}text/5000.svg`,

                // Labirinto
                `${imgBase}maze/maze_blue.svg`,
                `${imgBase}maze/maze_white.svg`, // <--- Faltou baixar este no .bat!

                // Misc
                'app/style/graphics/extra_life.png',
                'app/style/graphics/extra_life.svg', // <--- Faltou baixar este no .bat!
                'app/style/graphics/pacman_logo.png', // <--- Faltou baixar este no .bat!
                'app/style/graphics/backdrop.png', // <--- Faltou baixar este no .bat!
            ];
// Lista Gigante de todos os sons que o jogo precisa carregar.
            const audioBase = 'app/style/audio/';
            const audioSources = [
                `${audioBase}game_start.mp3`,
                `${audioBase}pause.mp3`,
                `${audioBase}pause_beat.mp3`,
                `${audioBase}siren_1.mp3`,
                `${audioBase}siren_2.mp3`,
                `${audioBase}siren_3.mp3`,
                `${audioBase}power_up.mp3`,
                `${audioBase}extra_life.mp3`,
                `${audioBase}eyes.mp3`,
                `${audioBase}eat_ghost.mp3`,
                `${audioBase}death.mp3`,
                `${audioBase}fruit.mp3`,
                `${audioBase}dot_1.mp3`,
                `${audioBase}dot_2.mp3`,
            ];

            const totalSources = imgSources.length + audioSources.length;
            this.remainingSources = totalSources;

            // Inicia a animação da barra de loading
            loadingPacman.style.left = '0';
            loadingDotMask.style.width = '0';

            // Inicia o download de todas as imagens e áudios ao mesmo tempo
            Promise.all([
                this.createElements(
                        imgSources, 'img', totalSources, this,
                        ),
                this.createElements(
                        audioSources, 'audio', totalSources, this,
                        ),
            ]).then(() => {
                // QUANDO TUDO CARREGAR:
                loadingContainer.style.opacity = 0; // Esconde a barra de loading
                resolve();

                // Espera 1.5s e mostra o Menu Principal ("PLAY")
                setTimeout(() => {
                    loadingContainer.remove();
                    this.mainMenu.style.opacity = 1;
                    this.mainMenu.style.visibility = 'visible';
                    
                    // Se não for Safari, clica em "PLAY" sozinho (auto-start)
                    if( !isSafari() ) {
                        // this.startButtonClick(); // Descomente esta linha se quiser auto-start
                    }
                }, 1500);
            }).catch(this.displayErrorMessage); // Se algo falhar, mostra "OOPS!"
        });
    }

    /**
     * Cria os elementos (img ou audio) para o pré-carregamento (preload).
     * Esta função é chamada pela 'preloadAssets'.
     * @param {Array} sources - A lista de caminhos (links) para os arquivos.
     * @param {string} type - 'img' or 'audio'.
     * @param {number} totalSources - O número total de arquivos (para a barra de progresso).
     * @param {Object} gameCoord - Referência ao 'this' (GameCoordinator).
     * @returns {Promise} - Uma promessa que é resolvida quando todos os assets deste tipo carregam.
     */
    createElements(sources, type, totalSources, gameCoord) {
        const loadingContainer = document.getElementById('loading-container');
        const preloadDiv = document.getElementById('preload-div'); // Div invisível
        const loadingPacman = document.getElementById('loading-pacman');
        const containerWidth = loadingContainer.scrollWidth
                - loadingPacman.scrollWidth;
        const loadingDotMask = document.getElementById('loading-dot-mask');

        const gameCoordRef = gameCoord; // Salva o 'this'

        return new Promise((resolve, reject) => {
            let loadedSources = 0; // Contador de quantos arquivos já carregaram

            sources.forEach((source) => {
                const element = (type === 'img')
                        ? new Image() : new Audio();

                // Adiciona o elemento na div invisível (isso força o navegador a baixar)
                preloadDiv.appendChild(element);

                // Função chamada QUANDO UM ARQUIVO TERMINA DE BAIXAR
                const elementReady = () => {
                    gameCoordRef.remainingSources -= 1;
                    loadedSources += 1;
                    
                    // Atualiza a barra de progresso
                    const percent = 1 - (gameCoordRef.remainingSources / totalSources);
                    loadingPacman.style.left = `${percent * containerWidth}px`;
                    loadingDotMask.style.width = loadingPacman.style.left;

                    // Se todos os arquivos desta lista carregaram, avisa a Promise
                    if (loadedSources === sources.length) {
                        resolve();
                    }
                };

                // Define os "escutadores" de evento
                if (type === 'img') {
                    element.onload = elementReady; // Imagem carregou
                    element.onerror = reject;   // Imagem deu erro
                } else {
                    element.addEventListener('canplaythrough', elementReady); // Áudio carregou
                    element.onerror = reject; // Áudio deu erro
                }

                // Define o 'src' (o link), que é o que dispara o download
                element.src = source;

                if (type === 'audio') {
                    element.load(); // Força o áudio a carregar
                }
            });
        });
    }
/**
     * Reseta o jogo para o estado inicial (usado no início e após "Game Over").
     */
    reset() {
        this.activeTimers = []; // Limpa todos os "setTimeout"
        this.points = 0;
        this.level = 1;
        this.lives = 2; // Vidas iniciais
        this.extraLifeGiven = false; // Flag para dar a vida extra aos 10.000 pontos
        this.remainingDots = 0; // Bolinhas restantes
        this.allowKeyPresses = true;
        this.allowPacmanMovement = false; // Pacman só se move após o "Ready!"
        this.allowPause = false; // Só pode pausar depois que o jogo começa
        this.cutscene = true; // "Cutscene" é o "Ready!" ou animação de morte
        this.highScore = localStorage.getItem('highScore'); // Pega o high score salvo

        // Se for o primeiro jogo (firstGame é true), cria os objetos.
        if (this.firstGame) {
            // Cria o loop que checa colisão com as bolinhas (roda 2x por segundo)
            setInterval(() => {
                this.collisionDetectionLoop();
            }, 500);

            // Cria o objeto Pacman
            this.pacman = new Pacman(
                    this.scaledTileSize, this.mazeArray, new CharacterUtil(),
                    );
            // Cria os 4 Fantasmas
            this.blinky = new Ghost(
                    this.scaledTileSize, this.mazeArray, this.pacman, 'blinky',
                    this.level, new CharacterUtil(),
                    );
            this.pinky = new Ghost(
                    this.scaledTileSize, this.mazeArray, this.pacman, 'pinky',
                    this.level, new CharacterUtil(),
                    );
            this.inky = new Ghost(
                    this.scaledTileSize, this.mazeArray, this.pacman, 'inky',
                    this.level, new CharacterUtil(), this.blinky,
                    );
            this.clyde = new Ghost(
                    this.scaledTileSize, this.mazeArray, this.pacman, 'clyde',
                    this.level, new CharacterUtil(),
                    );
            // Cria a Fruta (começa invisível)
            this.fruit = new Pickup(
                    'fruit', this.scaledTileSize, 13.5, 17, this.pacman,
                    this.mazeDiv, 100, // Começa valendo 100 (Cereja)
                    );
        }

        // Lista de todas as entidades que o GameEngine precisa atualizar
        this.entityList = [
            this.pacman, this.blinky, this.pinky, this.inky, this.clyde, this.fruit,
        ];

        // Lista separada só dos fantasmas
        this.ghosts = [
            this.blinky,
            this.pinky,
            this.inky,
            this.clyde,
        ];

        this.scaredGhosts = []; // Fantasmas que estão azuis
        this.eyeGhosts = 0; // Contagem de fantasmas que foram comidos

        if (this.firstGame) {
            // Se for o primeiro jogo, desenha as bolinhas no mapa
            this.drawMaze(this.mazeArray, this.entityList);
            // Cria o Gerenciador de Som
            this.soundManager = new SoundManager();
            // Ajusta o tamanho da fonte do placar
            this.setUiDimensions();
        } else {
            // Se NÃO for o primeiro jogo (ex: clicou em "PLAY" de novo)
            // Apenas reseta tudo
            this.pacman.reset();
            this.ghosts.forEach((ghost) => {
                ghost.reset(true); // 'true' reseta a velocidade
            });
            // Reseta todas as bolinhas para ficarem visíveis
            this.pickups.forEach((pickup) => {
                if (pickup.type !== 'fruit') {
                    this.remainingDots += 1;
                    pickup.reset();
                    this.entityList.push(pickup);
                }
            });
        }

        // Atualiza a interface (UI)
        this.pointsDisplay.innerHTML = '00';
        this.highScoreDisplay.innerHTML = this.highScore || '00';
        this.clearDisplay(this.fruitDisplay);

        // Define o volume (pega a preferência salva)
        const volumePreference = parseInt(
                localStorage.getItem('volumePreference') || 1, 10,
                );
        this.setSoundButtonIcon(volumePreference);
        this.soundManager.setMasterVolume(volumePreference);
    }

    /**
     * Inicia o "motor" do jogo (GameEngine).
     * Chamado apenas uma vez, pela função startButtonClick.
     */
    init() {
        this.registerEventListeners(); // Registra os "escutadores" de eventos

        // Cria o motor do jogo, que controla o loop de update/draw
        this.gameEngine = new GameEngine(this.maxFps, this.entityList);
        this.gameEngine.start(); // Liga o motor!
    }
/**
     * Desenha as bolinhas (pac-dots) no labirinto pela primeira vez.
     * Ele lê o 'mazeArray' e cria uma 'div' para cada 'o' ou 'O'.
     */
    drawMaze(mazeArray, entityList) {
        this.pickups = [
            this.fruit, // A fruta já existe, só adiciona na lista de "pickups"
        ];
        console.log('scaledTileSize', this.scaledTileSize); // Log para debug
        
        // Define o tamanho exato do labirinto em pixels
        this.mazeDiv.style.height = `${this.scaledTileSize * 31}px`;
        this.mazeDiv.style.width = `${this.scaledTileSize * 28}px`;
        
        // Ajusta o tamanho da UI (placar + vidas)
        this.gameUiContainer.style.width = `${this.scaledTileSize * 28}px`;
        this.bottomRow.style.minHeight = `${this.scaledTileSize * 2}px`;
        this.dotContainer = document.getElementById('dot-container');

        // Loop por cada "bloco" do mapa
        mazeArray.forEach((row, rowIndex) => {
            row.forEach((block, columnIndex) => {
                // Se o bloco for 'o' (bolinha) ou 'O' (pílula de poder)...
                if (block === 'o' || block === 'O') {
                    const type = (block === 'o') ? 'pacdot' : 'powerPellet';
                    const points = (block === 'o') ? 10 : 50;
                    
                    // ...cria um novo objeto Pickup (bolinha)
                    const dot = new Pickup(
                            type, this.scaledTileSize, columnIndex,
                            rowIndex, this.pacman, this.dotContainer, points,
                            );

                    // Adiciona a bolinha na lista de "entidades" (para o update)
                    // e na lista de "pickups" (para a colisão)
                    entityList.push(dot);
                    this.pickups.push(dot);
                    this.remainingDots += 1; // Incrementa o contador de bolinhas
                }
            });
        });
    }

    /** Ajusta o tamanho da fonte do placar (1UP, HIGH SCORE) */
    setUiDimensions() {
        this.gameUi.style.fontSize = `${this.scaledTileSize}px`;
        this.rowTop.style.marginBottom = `${this.scaledTileSize}px`;
    }

    /**
     * Loop (Intervalo) que checa se o Pacman está PERTO das bolinhas.
     * Isso é uma otimização: o jogo só checa colisão com bolinhas próximas,
     * em vez de checar todas as 244 bolinhas a cada frame.
     */
    collisionDetectionLoop() {
        if (this.pacman.position) {
            // Distância máxima para checar (750ms de movimento)
            const maxDistance = (this.pacman.velocityPerMs * 750);
            // Pega o centro do Pacman
            const pacmanCenter = {
                x: this.pacman.position.left + this.scaledTileSize,
                y: this.pacman.position.top + this.scaledTileSize,
            };

            // Flag de debug (se 'true', mostra as bolinhas próximas em verde)
            const debugging = false;

            // Manda cada "pickup" (bolinha/fruta) checar se está perto do Pacman
            this.pickups.forEach((pickup) => {
                pickup.checkPacmanProximity(maxDistance, pacmanCenter, debugging);
            });
        }
    }

    /**
     * Mostra o "Ready!" e começa o round.
     * @param {boolean} initialStart - True se for o comecinho do jogo (toca música)
     */
    startGameplay(initialStart) {
        if (initialStart) {
            // Toca a música de início
            if (isSafari()) {
                playSound('game_start');
            } else {
                this.soundManager.play('game_start');
            }
        }

        this.scaredGhosts = [];
        this.eyeGhosts = 0;
        this.allowPacmanMovement = false; // Trava o movimento

        // Define a posição do texto "Ready!"
        const left = this.scaledTileSize * 11;
        const top = this.scaledTileSize * 16.5;
        const duration = initialStart ? 4500 : 2000; // "Ready!" dura mais no início
        const width = this.scaledTileSize * 6;
        const height = this.scaledTileSize * 2;

        this.displayText({left, top}, 'ready', duration, width, height); // Mostra o "Ready!"
        this.updateExtraLivesDisplay(); // Atualiza as vidas

        // Timer para esperar o "Ready!" acabar
        new Timer(() => {
            this.allowPause = true; // Permite pausar
            this.cutscene = false; // Acabou a "cutscene"
            this.soundManager.setCutscene(this.cutscene);
            this.soundManager.setAmbience(this.determineSiren(this.remainingDots)); // Toca a sirene

            // Libera o Pacman
            this.allowPacmanMovement = true;
            this.pacman.moving = true;

            // Libera os Fantasmas
            this.ghosts.forEach((ghost) => {
                const ghostRef = ghost;
                ghostRef.moving = true;
            });

            // Inicia o ciclo de IA dos fantasmas (chase/scatter)
            this.ghostCycle('scatter');

            // Lista de fantasmas presos na "casa"
            this.idleGhosts = [
                this.pinky,
                this.inky,
                this.clyde,
            ];
            this.releaseGhost(); // Solta o primeiro (Pinky)
        }, duration);
    }

    /** Limpa uma div (usado para as vidas e frutas) */
    clearDisplay(display) {
        while (display.firstChild) {
            display.removeChild(display.firstChild);
        }
    }

    /**
     * Atualiza os ícones de vida (< <) no canto da tela.
     */
    updateExtraLivesDisplay() {
        this.clearDisplay(this.extraLivesDisplay); // Limpa as vidas antigas

        // Adiciona um ícone de Pacman para cada vida restante
        for (let i = 0; i < this.lives; i += 1) {
            const extraLifePic = document.createElement('img');
            extraLifePic.setAttribute('src', 'app/style/graphics/extra_life.svg');
            extraLifePic.style.height = `${this.scaledTileSize * 2}px`;
            this.extraLivesDisplay.appendChild(extraLifePic);
        }
    }

    /**
     * Atualiza os ícones de fruta no canto da tela.
     * @param {string} rawImageSource - O 'url(...)' da imagem da fruta.
     */
    updateFruitDisplay(rawImageSource) {
        // Pega só o link de dentro do 'url(...)'
        const parsedSource = rawImageSource.slice(
                rawImageSource.indexOf('(') + 1, rawImageSource.indexOf(')'),
                );

        // Se já tiver 7 frutas, remove a mais antiga
        if (this.fruitDisplay.children.length === 7) {
            this.fruitDisplay.removeChild(this.fruitDisplay.firstChild);
        }

        // Adiciona o ícone da nova fruta
        const fruitPic = document.createElement('img');
        fruitPic.setAttribute('src', parsedSource);
        fruitPic.style.height = `${this.scaledTileSize * 2}px`;
        this.fruitDisplay.appendChild(fruitPic);
    }

    /**
     * Controla o ciclo de IA dos fantasmas (chase/scatter).
     * Eles alternam entre "caçar" (chase) e "ir para o canto" (scatter).
     * @param {string} mode - O modo que vai começar agora ('chase' ou 'scatter').
     */
    ghostCycle(mode) {
        const delay = (mode === 'scatter') ? 7000 : 20000; // 7s disperso, 20s caçando
        const nextMode = (mode === 'scatter') ? 'chase' : 'scatter';

        // Cria um Timer para trocar o modo
        this.ghostCycleTimer = new Timer(() => {
            // Manda todos os fantasmas trocarem de modo
            this.ghosts.forEach((ghost) => {
                ghost.changeMode(nextMode);
            });

            // Chama a si mesmo para o próximo ciclo (loop infinito)
            this.ghostCycle(nextMode);
        }, delay);
    }

    /**
     * Libera o próximo fantasma da "casa".
     */
    releaseGhost() {
        if (this.idleGhosts.length > 0) {
            // O delay para soltar diminui a cada nível
            const delay = Math.max((8 - ((this.level - 1) * 4)) * 1000, 0);

            // Timer para soltar o fantasma
            this.endIdleTimer = new Timer(() => {
                this.idleGhosts[0].endIdleMode(); // Manda o fantasma sair
                this.idleGhosts.shift(); // Remove ele da lista de "presos"
            }, delay);
        }
    }

    /**
     * Registra todos os "escutadores" de eventos do jogo
     * (teclado, botões, eventos customizados).
     */
    registerEventListeners() {
        // Escutador de Teclado
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Eventos customizados (criados pelo próprio código)
        window.addEventListener('awardPoints', this.awardPoints.bind(this));
        window.addEventListener('deathSequence', this.deathSequence.bind(this)); // <-- IMPORTANTE
        window.addEventListener('dotEaten', this.dotEaten.bind(this));
        window.addEventListener('powerUp', this.powerUp.bind(this));
        window.addEventListener('eatGhost', this.eatGhost.bind(this));
        window.addEventListener('restoreGhost', this.restoreGhost.bind(this));
        window.addEventListener('addTimer', this.addTimer.bind(this));
        window.addEventListener('removeTimer', this.removeTimer.bind(this));
        window.addEventListener('releaseGhost', this.releaseGhost.bind(this));

        // Escutadores de Toque (D-Pad do celular)
        const directions = [
            'up', 'down', 'left', 'right',
        ];

        directions.forEach((direction) => {
            preventLongPressMenu(document.getElementById(`button-${direction}`));

            document.getElementById(`button-${direction}`).addEventListener(
                    'touchstart', () => {
                this.changeDirection(direction);
            },
                    );
        });
    }

    /**
     * Manda o Pacman mudar de direção.
     */
    changeDirection(direction) {
        if (this.allowKeyPresses && this.gameEngine.running) {
            this.pacman.changeDirection(
                    direction, this.allowPacmanMovement,
                    );
        }
    }

    /**
     * Lida com os cliques do Teclado.
     * @param {Event} e - O evento do teclado.
     */
    handleKeyDown(e) {
        if (e.keyCode === 27) {
            // Tecla ESC (Pause)
            this.handlePauseKey();
        } else if (e.keyCode === 81) {
            // Tecla Q (Mudo)
            this.soundButtonClick();
        } else if (this.movementKeys[e.keyCode]) {
            // Teclas de Seta ou WASD
            this.changeDirection(this.movementKeys[e.keyCode]);
        }
    }

    /**
     * Lógica de Pausar e Despausar o jogo.
     */
    handlePauseKey() {
        if (this.allowPause) {
            this.allowPause = false; // Trava o botão de pause (evita clique duplo)

            // Destrava o botão de pause depois de 500ms
            setTimeout(() => {
                if (!this.cutscene) {
                    this.allowPause = true;
                }
            }, 500);

            // Pausa ou Despausa o "motor" do jogo
            this.gameEngine.changePausedState(this.gameEngine.running);
            this.soundManager.play('pause');

            if (this.gameEngine.started) {
                // DESPAUSANDO
                this.soundManager.resumeAmbience();
                this.gameUiContainer.style.filter = 'unset'; // Remove o blur
                this.movementButtons.style.filter = 'unset';
                this.pausedText.style.visibility = 'hidden'; // Esconde "PAUSED"
                this.pauseButton.innerHTML = 'pause'; // Ícone de pause
                // Reseta todos os timers
                this.activeTimers.forEach((timer) => {
                    timer.resume();
                });
            } else {
                // PAUSANDO
                this.soundManager.stopAmbience();
                this.soundManager.setAmbience('pause_beat', true); // Toca a batida
                this.gameUiContainer.style.filter = 'blur(5px)'; // Aplica o blur
                this.movementButtons.style.filter = 'blur(5px)';
                this.pausedText.style.visibility = 'visible'; // Mostra "PAUSED"
                this.pauseButton.innerHTML = 'play_arrow'; // Ícone de play
                // Pausa todos os timers (duração do "Ready!", etc.)
                this.activeTimers.forEach((timer) => {
                    timer.pause();
                });
            }
        }
    }

    /**
     * Adiciona pontos ao placar.
     * @param {Event} e - Evento com 'e.detail.points' (quantos pontos)
     */
    awardPoints(e) {
        this.points += e.detail.points;
        this.pointsDisplay.innerText = this.points;
        
        // Checa se bateu o High Score
        if (this.points > (this.highScore || 0)) {
            this.highScore = this.points;
            this.highScoreDisplay.innerText = this.points;
            localStorage.setItem('highScore', this.highScore);
        }

        // Ganha vida extra aos 10.000 pontos
        if (this.points >= 10000 && !this.extraLifeGiven) {
            this.extraLifeGiven = true;
            this.soundManager.play('extra_life');
            this.lives += 1;
            this.updateExtraLivesDisplay();
        }

        // Se os pontos vieram de uma fruta
        if (e.detail.type === 'fruit') {
            // ... (lógica para mostrar os pontos da fruta na tela) ...
            this.soundManager.play('fruit');
            this.updateFruitDisplay(this.fruit.determineImage(
                    'fruit', e.detail.points,
                    ));
        }
    }
/**
     * **FUNÇÃO MAIS IMPORTANTE PARA O SEU PROJETO**
     * Chamada quando o Pacman colide com um fantasma (evento 'deathSequence').
     * É AQUI QUE VOCÊ VAI COLOCAR SEU QUIZ!
     */
    deathSequence() {
        // 1. Para tudo (timers, sons, movimento)
        this.allowPause = false; // Não pode pausar durante a morte
        this.cutscene = true; // Ativa o modo "cutscene"
        this.soundManager.setCutscene(this.cutscene);
        this.soundManager.stopAmbience(); // Para a sirene
        
        // Limpa todos os timers (fruta, ciclo de IA, soltar fantasma, piscar)
        this.removeTimer({detail: {timer: this.fruitTimer}});
        this.removeTimer({detail: {timer: this.ghostCycleTimer}});
        this.removeTimer({detail: {timer: this.endIdleTimer}});
        this.removeTimer({detail: {timer: this.ghostFlashTimer}});

        // Trava o teclado e para todos os personagens
        this.allowKeyPresses = false;
        this.pacman.moving = false;
        this.ghosts.forEach((ghost) => {
            const ghostRef = ghost;
            ghostRef.moving = false;
        });

        // 2. Timer para a animação de morte (espera 750ms)
        new Timer(() => {
            // Esconde os fantasmas
            this.ghosts.forEach((ghost) => {
                const ghostRef = ghost;
                ghostRef.display = false;
            });
            // Inicia a animação do Pacman "fechando"
            this.pacman.prepDeathAnimation();
            this.soundManager.play('death'); // Toca o som de morte

            
            // --- MODIFICAÇÃO PARA O QUIZ (Plano) ---
            //
            // É AQUI! Em vez de checar 'this.lives', você primeiro mostraria o quiz.
            // 1. Mostrar a div do Quiz (ex: quizDiv.style.visibility = 'visible';)
            // 2. Chamar sua função PHP/Gemini para buscar uma pergunta.
            // 3. Esperar o jogador responder.
            //
            // 4. SE O JOGADOR ACERTAR:
            //    Chamar a lógica 'if (this.lives > 0) { ... }' abaixo.
            // 5. SE O JOGADOR ERRAR:
            //    Perder todas as vidas (this.lives = 0;) e chamar 'this.gameOver();'
            //
            // --- Fim da Modificação ---


            // 3. Lógica Original: Verifica se tem vidas restantes
            if (this.lives > 0) {
                this.lives -= 1; // Perde uma vida

                // Timer para reiniciar o nível (espera 2.25s)
                new Timer(() => {
                    this.mazeCover.style.visibility = 'visible'; // Tela preta
                    new Timer(() => {
                        // Reseta tudo para o "Ready!"
                        this.allowKeyPresses = true;
                        this.mazeCover.style.visibility = 'hidden';
                        this.pacman.reset();
                        this.ghosts.forEach((ghost) => {
                            ghost.reset();
                        });
                        this.fruit.hideFruit();

                        this.startGameplay(); // Reinicia (mostra "Ready!")
                    }, 500);
                }, 2250);
            } else {
                // Se não tem mais vidas (this.lives === 0)
                this.gameOver();
            }
        }, 750);
    }

    /**
     * Mostra a tela de "GAME OVER" e o menu principal.
     */
    gameOver() {
        localStorage.setItem('highScore', this.highScore); // Salva o High Score

        new Timer(() => {
            // Mostra o texto "GAME OVER"
            this.displayText(
                    {
                        left: this.scaledTileSize * 9,
                        top: this.scaledTileSize * 16.5,
                    },
                    'game_over', 4000,
                    this.scaledTileSize * 10,
                    this.scaledTileSize * 2,
                    );
            this.fruit.hideFruit();

            // Timer para fechar as "cortinas" amarelas
            new Timer(() => {
                this.leftCover.style.left = '0';
                this.rightCover.style.right = '0';

                // Timer para mostrar o Menu Principal ("PLAY")
                setTimeout(() => {
                    this.mainMenu.style.opacity = 1;
                    this.gameStartButton.disabled = false;
                    this.mainMenu.style.visibility = 'visible';
                }, 1000);
            }, 2500);
        }, 2250);
    }

    /**
     * Chamado quando o jogador come uma bolinha (evento 'dotEaten').
     */
    dotEaten() {
        this.remainingDots -= 1; // Subtrai uma bolinha do total

        this.soundManager.playDotSound(); // Toca o som "waka-waka"

        // Lógica para criar frutas (baseado no número de bolinhas comidas)
        if (this.remainingDots === 174 || this.remainingDots === 74) {
            this.createFruit();
        }

        // Lógica do "Cruise Elroy" (Blinky fica mais rápido)
        if (this.remainingDots === 40 || this.remainingDots === 20) {
            this.speedUpBlinky();
        }

        // Se acabaram as bolinhas
        if (this.remainingDots === 0) {
            this.advanceLevel(); // Passa de nível!
        }
    }

    /**
     * Cria a fruta bônus na tela.
     */
    createFruit() {
        this.removeTimer({detail: {timer: this.fruitTimer}}); // Remove a fruta anterior (se houver)
        // Mostra a fruta (pega os pontos baseado no nível)
        this.fruit.showFruit(this.fruitPoints[this.level] || 5000); 
        
        // A fruta desaparece depois de 10 segundos
        this.fruitTimer = new Timer(() => {
            this.fruit.hideFruit();
        }, 10000);
    }

    /**
     * Acelera o Blinky (Cruise Elroy) e muda a sirene para um tom mais rápido.
     */
    speedUpBlinky() {
        this.blinky.speedUp();

        // Só muda a sirene se o Pacman não estiver com power-up (modo assustado)
        if (this.scaredGhosts.length === 0 && this.eyeGhosts === 0) {
            this.soundManager.setAmbience(this.determineSiren(this.remainingDots));
        }
    }

    /**
     * Decide qual sirene (som de ambiente) deve tocar.
     * @param {Number} remainingDots - Quantas bolinhas faltam.
     * @returns {String} - O nome do arquivo de som (ex: 'siren_1').
     */
    determineSiren(remainingDots) {
        let sirenNum;

        if (remainingDots > 40) {
            sirenNum = 1; // Normal
        } else if (remainingDots > 20) {
            sirenNum = 2; // Rápida
        } else {
            sirenNum = 3; // Super-rápida
        }

        return `siren_${sirenNum}`;
    }

    /**
     * Chamado quando o jogador come todas as bolinhas.
     */
    advanceLevel() {
        // 1. Para tudo (timers, sons, movimento)
        this.allowPause = false;
        this.cutscene = true;
        this.soundManager.setCutscene(this.cutscene);
        this.allowKeyPresses = false;
        this.soundManager.stopAmbience();
        this.entityList.forEach((entity) => {
            const entityRef = entity;
            entityRef.moving = false;
        });
        
        // Limpa todos os timers
        this.removeTimer({detail: {timer: this.fruitTimer}});
        this.removeTimer({detail: {timer: this.ghostCycleTimer}});
        this.removeTimer({detail: {timer: this.endIdleTimer}});
        this.removeTimer({detail: {timer: this.ghostFlashTimer}});

        const imgBase = 'app/style/graphics/spriteSheets/maze/'; // Corrigido

        // 2. Animação de piscar o labirinto (azul e branco)
        new Timer(() => {
            this.ghosts.forEach((ghost) => {
                const ghostRef = ghost;
                ghostRef.display = false;
            });

            this.mazeImg.src = `${imgBase}maze_white.svg`;
            new Timer(() => {
                this.mazeImg.src = `${imgBase}maze_blue.svg`;
                new Timer(() => {
                    this.mazeImg.src = `${imgBase}maze_white.svg`;
                    new Timer(() => {
                        this.mazeImg.src = `${imgBase}maze_blue.svg`;
                        new Timer(() => {
                            this.mazeImg.src = `${imgBase}maze_white.svg`;
                            new Timer(() => {
                                this.mazeImg.src = `${imgBase}maze_blue.svg`;
                                new Timer(() => {
                                    // 3. Reseta o nível
                                    this.mazeCover.style.visibility = 'visible'; // Tela preta
                                    new Timer(() => {
                                        this.mazeCover.style.visibility = 'hidden';
                                        this.level += 1; // Aumenta o nível
                                        this.allowKeyPresses = true;
                                        
                                        // Reseta todas as entidades (Pacman, fantasmas, bolinhas)
                                        this.entityList.forEach((entity) => {
                                            const entityRef = entity;
                                            if (entityRef.level) {
                                                entityRef.level = this.level; // Atualiza o nível (para velocidade)
                                            }
                                            entityRef.reset();
                                            if (entityRef instanceof Ghost) {
                                                entityRef.resetDefaultSpeed(); // Blinky volta ao normal
                                            }
                                            // Se for uma bolinha...
                                            if (entityRef instanceof Pickup
                                                    && entityRef.type !== 'fruit') {
                                                this.remainingDots += 1; // Re-conta as bolinhas
                                            }
                                        });
                                        this.startGameplay(); // Começa o "Ready!" do novo nível
                                    }, 500);
                                }, 250);
                            }, 250);
                        }, 250);
                    }, 250);
                }, 250);
            }, 250);
        }, 2000); // Espera 2s antes de piscar
    }
/**
     * **FUNÇÃO MAIS IMPORTANTE PARA O SEU PROJETO**
     * Chamada quando o Pacman colide com um fantasma (evento 'deathSequence').
     * É AQUI QUE VOCÊ VAI COLOCAR SEU QUIZ!
     */
    deathSequence() {
        // 1. Para tudo (timers, sons, movimento)
        this.allowPause = false; // Não pode pausar durante a morte
        this.cutscene = true; // Ativa o modo "cutscene"
        this.soundManager.setCutscene(this.cutscene);
        this.soundManager.stopAmbience(); // Para a sirene
        
        // Limpa todos os timers (fruta, ciclo de IA, soltar fantasma, piscar)
        this.removeTimer({detail: {timer: this.fruitTimer}});
        this.removeTimer({detail: {timer: this.ghostCycleTimer}});
        this.removeTimer({detail: {timer: this.endIdleTimer}});
        this.removeTimer({detail: {timer: this.ghostFlashTimer}});

        // Trava o teclado e para todos os personagens
        this.allowKeyPresses = false;
        this.pacman.moving = false;
        this.ghosts.forEach((ghost) => {
            const ghostRef = ghost;
            ghostRef.moving = false;
        });

        // 2. Timer para a animação de morte (espera 750ms)
        new Timer(() => {
            // Esconde os fantasmas
            this.ghosts.forEach((ghost) => {
                const ghostRef = ghost;
                ghostRef.display = false;
            });
            // Inicia a animação do Pacman "fechando"
            this.pacman.prepDeathAnimation();
            this.soundManager.play('death'); // Toca o som de morte

            
            // --- MODIFICAÇÃO PARA O QUIZ (Plano) ---
            //
            // É AQUI! Em vez de checar 'this.lives', você primeiro mostraria o quiz.
            // 1. Mostrar a div do Quiz (ex: quizDiv.style.visibility = 'visible';)
            // 2. Chamar sua função PHP/Gemini para buscar uma pergunta.
            // 3. Esperar o jogador responder.
            //
            // 4. SE O JOGADOR ACERTAR:
            //    Chamar a lógica 'if (this.lives > 0) { ... }' abaixo.
            // 5. SE O JOGADOR ERRAR:
            //    Perder todas as vidas (this.lives = 0;) e chamar 'this.gameOver();'
            //
            // --- Fim da Modificação ---


            // 3. Lógica Original: Verifica se tem vidas restantes
            if (this.lives > 0) {
                this.lives -= 1; // Perde uma vida

                // Timer para reiniciar o nível (espera 2.25s)
                new Timer(() => {
                    this.mazeCover.style.visibility = 'visible'; // Tela preta
                    new Timer(() => {
                        // Reseta tudo para o "Ready!"
                        this.allowKeyPresses = true;
                        this.mazeCover.style.visibility = 'hidden';
                        this.pacman.reset();
                        this.ghosts.forEach((ghost) => {
                            ghost.reset();
                        });
                        this.fruit.hideFruit();

                        this.startGameplay(); // Reinicia (mostra "Ready!")
                    }, 500);
                }, 2250);
            } else {
                // Se não tem mais vidas (this.lives === 0)
                this.gameOver();
            }
        }, 750);
    }

    /**
     * Mostra a tela de "GAME OVER" e o menu principal.
     */
    gameOver() {
        localStorage.setItem('highScore', this.highScore); // Salva o High Score

        new Timer(() => {
            // Mostra o texto "GAME OVER"
            this.displayText(
                    {
                        left: this.scaledTileSize * 9,
                        top: this.scaledTileSize * 16.5,
                    },
                    'game_over', 4000,
                    this.scaledTileSize * 10,
                    this.scaledTileSize * 2,
                    );
            this.fruit.hideFruit();

            // Timer para fechar as "cortinas" amarelas
            new Timer(() => {
                this.leftCover.style.left = '0';
                this.rightCover.style.right = '0';

                // Timer para mostrar o Menu Principal ("PLAY")
                setTimeout(() => {
                    this.mainMenu.style.opacity = 1;
                    this.gameStartButton.disabled = false;
                    this.mainMenu.style.visibility = 'visible';
                }, 1000);
            }, 2500);
        }, 2250);
    }

    /**
     * Chamado quando o jogador come uma bolinha (evento 'dotEaten').
     */
    dotEaten() {
        this.remainingDots -= 1; // Subtrai uma bolinha do total

        this.soundManager.playDotSound(); // Toca o som "waka-waka"

        // Lógica para criar frutas (baseado no número de bolinhas comidas)
        if (this.remainingDots === 174 || this.remainingDots === 74) {
            this.createFruit();
        }

        // Lógica do "Cruise Elroy" (Blinky fica mais rápido)
        if (this.remainingDots === 40 || this.remainingDots === 20) {
            this.speedUpBlinky();
        }

        // Se acabaram as bolinhas
        if (this.remainingDots === 0) {
            this.advanceLevel(); // Passa de nível!
        }
    }

    /**
     * Cria a fruta bônus na tela.
     */
    createFruit() {
        this.removeTimer({detail: {timer: this.fruitTimer}}); // Remove a fruta anterior (se houver)
        // Mostra a fruta (pega os pontos baseado no nível)
        this.fruit.showFruit(this.fruitPoints[this.level] || 5000); 
        
        // A fruta desaparece depois de 10 segundos
        this.fruitTimer = new Timer(() => {
            this.fruit.hideFruit();
        }, 10000);
    }

    /**
     * Acelera o Blinky (Cruise Elroy) e muda a sirene para um tom mais rápido.
     */
    speedUpBlinky() {
        this.blinky.speedUp();

        // Só muda a sirene se o Pacman não estiver com power-up (modo assustado)
        if (this.scaredGhosts.length === 0 && this.eyeGhosts === 0) {
            this.soundManager.setAmbience(this.determineSiren(this.remainingDots));
        }
    }

    /**
     * Decide qual sirene (som de ambiente) deve tocar.
     * @param {Number} remainingDots - Quantas bolinhas faltam.
     * @returns {String} - O nome do arquivo de som (ex: 'siren_1').
     */
    determineSiren(remainingDots) {
        let sirenNum;

        if (remainingDots > 40) {
            sirenNum = 1; // Normal
        } else if (remainingDots > 20) {
            sirenNum = 2; // Rápida
        } else {
            sirenNum = 3; // Super-rápida
        }

        return `siren_${sirenNum}`;
    }

    /**
     * Chamado quando o jogador come todas as bolinhas.
     */
    advanceLevel() {
        // 1. Para tudo (timers, sons, movimento)
        this.allowPause = false;
        this.cutscene = true;
        this.soundManager.setCutscene(this.cutscene);
        this.allowKeyPresses = false;
        this.soundManager.stopAmbience();
        this.entityList.forEach((entity) => {
            const entityRef = entity;
            entityRef.moving = false;
        });
        
        // Limpa todos os timers
        this.removeTimer({detail: {timer: this.fruitTimer}});
        this.removeTimer({detail: {timer: this.ghostCycleTimer}});
        this.removeTimer({detail: {timer: this.endIdleTimer}});
        this.removeTimer({detail: {timer: this.ghostFlashTimer}});

        const imgBase = 'app/style/graphics/spriteSheets/maze/'; // Corrigido

        // 2. Animação de piscar o labirinto (azul e branco)
        new Timer(() => {
            this.ghosts.forEach((ghost) => {
                const ghostRef = ghost;
                ghostRef.display = false;
            });

            this.mazeImg.src = `${imgBase}maze_white.svg`;
            new Timer(() => {
                this.mazeImg.src = `${imgBase}maze_blue.svg`;
                new Timer(() => {
                    this.mazeImg.src = `${imgBase}maze_white.svg`;
                    new Timer(() => {
                        this.mazeImg.src = `${imgBase}maze_blue.svg`;
                        new Timer(() => {
                            this.mazeImg.src = `${imgBase}maze_white.svg`;
                            new Timer(() => {
                                this.mazeImg.src = `${imgBase}maze_blue.svg`;
                                new Timer(() => {
                                    // 3. Reseta o nível
                                    this.mazeCover.style.visibility = 'visible'; // Tela preta
                                    new Timer(() => {
                                        this.mazeCover.style.visibility = 'hidden';
                                        this.level += 1; // Aumenta o nível
                                        this.allowKeyPresses = true;
                                        
                                        // Reseta todas as entidades (Pacman, fantasmas, bolinhas)
                                        this.entityList.forEach((entity) => {
                                            const entityRef = entity;
                                            if (entityRef.level) {
                                                entityRef.level = this.level; // Atualiza o nível (para velocidade)
                                            }
                                            entityRef.reset();
                                            if (entityRef instanceof Ghost) {
                                                entityRef.resetDefaultSpeed(); // Blinky volta ao normal
                                            }
                                            // Se for uma bolinha...
                                            if (entityRef instanceof Pickup
                                                    && entityRef.type !== 'fruit') {
                                                this.remainingDots += 1; // Re-conta as bolinhas
                                            }
                                        });
                                        this.startGameplay(); // Começa o "Ready!" do novo nível
                                    }, 500);
                                }, 250);
                            }, 250);
                        }, 250);
                    }, 250);
                }, 250);
            }, 250);
        }, 2000); // Espera 2s antes de piscar
    }
/**
     * Faz os fantasmas piscarem (azul e branco) para indicar que o "power up" está acabando.
     * @param {Number} flashes - Contador de quantos "blinks" já deu.
     * @param {Number} maxFlashes - Total de "blinks" (normalmente 9).
     */
    flashGhosts(flashes, maxFlashes) {
        // Se já piscou o máximo de vezes...
        if (flashes === maxFlashes) {
            // ...manda todos os fantasmas assustados voltarem ao normal.
            this.scaredGhosts.forEach((ghost) => {
                ghost.endScared();
            });
            this.scaredGhosts = []; // Limpa a lista
            // Se não houver fantasmas "olhos" correndo, volta a sirene normal.
            if (this.eyeGhosts === 0) {
                this.soundManager.setAmbience(this.determineSiren(this.remainingDots));
            }
        } 
        // Se ainda pode piscar...
        else if (this.scaredGhosts.length > 0) {
            // Manda todos os fantasmas trocarem de cor (azul -> branco ou branco -> azul)
            this.scaredGhosts.forEach((ghost) => {
                ghost.toggleScaredColor();
            });

            // Cria um timer para chamar esta mesma função de novo (loop)
            this.ghostFlashTimer = new Timer(() => {
                this.flashGhosts(flashes + 1, maxFlashes);
            }, 250); // Pisca a cada 250ms
        }
    }

    /**
     * Chamado quando o Pacman come uma Pílula de Poder (evento 'powerUp').
     */
    powerUp() {
        // Se não for a última bolinha, toca o som de "power up"
        if (this.remainingDots !== 0) {
            this.soundManager.setAmbience('power_up');
        }

        // Para qualquer "pisca-pisca" anterior
        this.removeTimer({detail: {timer: this.ghostFlashTimer}});

        this.ghostCombo = 0; // Zera o combo de comer fantasmas
        this.scaredGhosts = []; // Limpa a lista de fantasmas assustados

        // Adiciona todos os fantasmas (que não são "olhos") na lista de assustados
        this.ghosts.forEach((ghost) => {
            if (ghost.mode !== 'eyes') {
                this.scaredGhosts.push(ghost);
            }
        });

        // Manda todos eles ficarem "assustados" (azuis e darem meia-volta)
        this.scaredGhosts.forEach((ghost) => {
            ghost.becomeScared();
        });

        // Calcula a duração do poder (diminui a cada nível)
        const powerDuration = Math.max((7 - this.level) * 1000, 0);
        
        // Cria o timer para começar a PISCAR (quando o tempo estiver acabando)
        this.ghostFlashTimer = new Timer(() => {
            this.flashGhosts(0, 9); // Começa a piscar (0 de 9 piscadas)
        }, powerDuration);
    }

    /**
     * Determina a pontuação de "combo" ao comer fantasmas.
     * 1º = 200, 2º = 400, 3º = 800, 4º = 1600
     */
    determineComboPoints() {
        // (100 * 2^1 = 200), (100 * 2^2 = 400), etc.
        return (100 * (2 ** this.ghostCombo));
    }

    /**
     * Chamado quando o Pacman come um fantasma (evento 'eatGhost').
     * @param {Event} e - O evento que contém o fantasma comido (e.detail.ghost).
     */
    eatGhost(e) {
        const pauseDuration = 1000; // O jogo congela por 1 segundo
        const {position, measurement} = e.detail.ghost; // Pega a posição do fantasma

        // Pausa todos os timers principais (de piscar, de IA, da fruta)
        this.pauseTimer({detail: {timer: this.ghostFlashTimer}});
        this.pauseTimer({detail: {timer: this.ghostCycleTimer}});
        this.pauseTimer({detail: {timer: this.fruitTimer}});
        
        this.soundManager.play('eat_ghost'); // Toca o som de "comer fantasma"

        // Remove o fantasma comido da lista de "assustados"
        this.scaredGhosts = this.scaredGhosts.filter(
                ghost => ghost.name !== e.detail.ghost.name,
                );
        this.eyeGhosts += 1; // Adiciona +1 na contagem de "olhos"

        // Lógica do Combo
        this.ghostCombo += 1;
        const comboPoints = this.determineComboPoints();
        // Dispara o evento para adicionar os pontos ao placar
        window.dispatchEvent(new CustomEvent('awardPoints', {
            detail: {
                points: comboPoints,
            },
        }));
        // Mostra o número (ex: "400") na tela
        this.displayText(
                position, comboPoints, pauseDuration, measurement,
                );

        // Congela o jogo
        this.allowPacmanMovement = false;
        this.pacman.display = false; // Esconde o Pacman
        this.pacman.moving = false;
        e.detail.ghost.display = false; // Esconde o fantasma azul
        e.detail.ghost.moving = false;

        // Pausa a animação de todos os outros fantasmas
        this.ghosts.forEach((ghost) => {
            const ghostRef = ghost;
            ghostRef.animate = false;
            ghostRef.pause(true);
            ghostRef.allowCollision = false; // Evita bugs de colisão dupla
        });

        // Timer para "descongelar" o jogo
        new Timer(() => {
            this.soundManager.setAmbience('eyes'); // Toca o som dos "olhos" voltando

            // Despausa os timers
            this.resumeTimer({detail: {timer: this.ghostFlashTimer}});
            this.resumeTimer({detail: {timer: this.ghostCycleTimer}});
            this.resumeTimer({detail: {timer: this.fruitTimer}});
            
            // Descongela o Pacman e o fantasma (que agora é "olhos")
            this.allowPacmanMovement = true;
            this.pacman.display = true;
            this.pacman.moving = true;
            e.detail.ghost.display = true; // Mostra os "olhos"
            e.detail.ghost.moving = true;
            
            // Descongela todos os outros fantasmas
            this.ghosts.forEach((ghost) => {
                const ghostRef = ghost;
                ghostRef.animate = true;
                ghostRef.pause(false);
                ghostRef.allowCollision = true;
            });
        }, pauseDuration);
    }

    /**
     * Chamado quando um fantasma "olhos" chega na casa (evento 'restoreGhost').
     */
    restoreGhost() {
        this.eyeGhosts -= 1; // Subtrai da contagem de "olhos"

        // Se não há mais "olhos" voltando...
        if (this.eyeGhosts === 0) {
            // ...volta o som de ambiente para "power_up" (se ainda estiver valendo)
            // ou para a sirene normal.
            const sound = this.scaredGhosts.length > 0
                    ? 'power_up' : this.determineSiren(this.remainingDots);
            this.soundManager.setAmbience(sound);
        }
    }

    /**
     * Cria o texto flutuante de pontos (ex: "200", "400") na tela.
     * @param {Object} position - Posição {left, top} onde o texto deve aparecer.
     * @param {Number} amount - O número (ex: 200).
     * @param {Number} duration - Quanto tempo fica na tela (ms).
     * @param {Number} width - Largura da imagem.
     * @param {Number} height - Altura da imagem.
     */
    displayText(position, amount, duration, width, height) {
        const pointsDiv = document.createElement('div');

        pointsDiv.style.position = 'absolute';
        pointsDiv.style.backgroundSize = `${width}px`;
        // Pega a imagem do texto (ex: 'text/200.svg')
        pointsDiv.style.backgroundImage = 'url(app/style/graphics/'
                + `spriteSheets/text/${amount}.svg`;
        pointsDiv.style.width = `${width}px`;
        pointsDiv.style.height = `${height || width}px`;
        pointsDiv.style.top = `${position.top}px`;
        pointsDiv.style.left = `${position.left}px`;
        pointsDiv.style.zIndex = 2; // Garante que fique na frente

        this.mazeDiv.appendChild(pointsDiv);

        // Timer para remover o texto da tela
        new Timer(() => {
            this.mazeDiv.removeChild(pointsDiv);
        }, duration);
    }

    /** Adiciona um Timer (setTimeout) na lista de timers ativos. */
    addTimer(e) {
        this.activeTimers.push(e.detail.timer);
    }

    /** Verifica se um Timer existe. */
    timerExists(e) {
        return !!(e.detail.timer || {}).timerId;
    }

    /** Pausa um Timer específico (usado pelo 'handlePauseKey'). */
    pauseTimer(e) {
        if (this.timerExists(e)) {
            e.detail.timer.pause(true);
        }
    }

    /** Despausa um Timer específico. */
    resumeTimer(e) {
        if (this.timerExists(e)) {
            e.detail.timer.resume(true);
        }
    }

    /** Remove um Timer da lista (quando ele termina ou é cancelado). */
    removeTimer(e) {
        if (this.timerExists(e)) {
            window.clearTimeout(e.detail.timer.timerId);
            this.activeTimers = this.activeTimers.filter(
                    timer => timer.timerId !== e.detail.timer.timerId,
                    );
        }
    }
} // <-- FIM DA CLASSE GAMECOORDINATOR


// =================================================================================
// CLASSE DO "MOTOR" DO JOGO (GameEngine)
// Controla o loop principal (Update e Draw)
// =================================================================================
class GameEngine {
    /**
     * @param {number} maxFps - FPS máximo (ex: 120).
     * @param {Array} entityList - A lista de todos os objetos (Pacman, fantasmas, bolinhas).
     */
    constructor(maxFps, entityList) {
        this.fpsDisplay = document.getElementById('fps-display'); // Pega a div do FPS
        this.elapsedMs = 0; // Tempo acumulado
        this.lastFrameTimeMs = 0; // Tempo do último frame
        this.entityList = entityList;
        this.maxFps = maxFps;
        this.timestep = 1000 / this.maxFps; // Quanto tempo dura 1 frame (ex: 8.33ms)
        this.fps = this.maxFps;
        this.framesThisSecond = 0;
        this.lastFpsUpdate = 0;
        this.frameId = 0; // ID da animação (para poder cancelar)
        this.running = false;
        this.started = false;
    }

    /**
     * Pausa ou Despausa o motor.
     * @param {boolean} running - Se o jogo está rodando (true = pausar).
     */
    changePausedState(running) {
        if (running) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Atualiza o contador de FPS na tela (o seu FPS RGB!)
     * @param {number} timestamp - O tempo atual.
     */
    updateFpsDisplay(timestamp) {
        // Atualiza o texto do FPS 1x por segundo
        if (timestamp > this.lastFpsUpdate + 1000) {
            this.fps = (this.framesThisSecond + this.fps) / 2; // Média de FPS
            this.lastFpsUpdate = timestamp;
            this.framesThisSecond = 0;
        }
        this.framesThisSecond += 1;
        // AQUI! O JS já atualiza o texto, só precisava do CSS para mostrar.
        this.fpsDisplay.textContent = `${Math.round(this.fps)} FPS`;
    }

    /**
     * Chama a função .draw() de todas as entidades (Pacman, fantasmas, etc.).
     * @param {number} interp - Fator de interpolação (para suavizar).
     * @param {Array} entityList - Lista de tudo.
     */
    draw(interp, entityList) {
        entityList.forEach((entity) => {
            if (typeof entity.draw === 'function') {
                entity.draw(interp);
            }
        });
    }

    /**
     * Chama a função .update() de todas as entidades (Pacman, fantasmas, bolinhas).
     * @param {number} elapsedMs - Tempo desde o último update.
     * @param {Array} entityList - Lista de tudo.
     */
    update(elapsedMs, entityList) {
        entityList.forEach((entity) => {
            if (typeof entity.update === 'function') {
                entity.update(elapsedMs);
            }
        });
    }

    /**
     * "Pânico". Se o jogo travar e acumular muitos frames,
     * esta função joga fora o tempo acumulado para evitar crashar.
     */
    panic() {
        this.elapsedMs = 0;
    }
 /**
     * Inicia o motor do jogo e o loop principal (mainLoop).
     */
    start() {
        if (!this.started) {
            this.started = true;

            // Solicita o primeiro frame de animação
            this.frameId = requestAnimationFrame((firstTimestamp) => {
                // Desenha o primeiro frame (estado inicial)
                this.draw(1, this.entityList); // Alterado de [] para this.entityList
                this.running = true;
                this.lastFrameTimeMs = firstTimestamp;
                this.lastFpsUpdate = firstTimestamp;
                this.framesThisSecond = 0;

                // Solicita o segundo frame, que inicia o loop principal
                this.frameId = requestAnimationFrame((timestamp) => {
                    this.mainLoop(timestamp);
                });
            });
        }
    }

    /**
     * Para o motor do jogo (usado no Pause).
     */
    stop() {
        this.running = false;
        this.started = false;
        cancelAnimationFrame(this.frameId); // Para o loop 'requestAnimationFrame'
    }

    /**
     * Processa todos os frames de LÓGICA (update) que se acumularam
     * desde a última renderização (draw).
     */
    processFrames() {
        let numUpdateSteps = 0;
        // Enquanto o tempo acumulado (elapsedMs) for maior que um "passo" (timestep)...
        while (this.elapsedMs >= this.timestep) {
            // ...roda um "passo" da lógica do jogo.
            this.update(this.timestep, this.entityList);
            this.elapsedMs -= this.timestep;
            numUpdateSteps += 1;
            
            // Se acumular muitos (ex: 120) frames, "panica" para não travar.
            if (numUpdateSteps >= this.maxFps) {
                this.panic();
                break;
            }
        }
    }

    /**
     * Um ciclo do motor: calcula o tempo, processa a lógica (update) e desenha (draw).
     */
    engineCycle(timestamp) {
        // Se não passou tempo suficiente para o próximo frame, espera.
        if (timestamp < this.lastFrameTimeMs + (1000 / this.maxFps)) {
            this.frameId = requestAnimationFrame((nextTimestamp) => {
                this.mainLoop(nextTimestamp);
            });
            return;
        }

        // Acumula o tempo que passou desde o último frame
        this.elapsedMs += timestamp - this.lastFrameTimeMs;
        this.lastFrameTimeMs = timestamp;
        
        this.updateFpsDisplay(timestamp); // Atualiza o contador de FPS
        this.processFrames(); // Roda a lógica (update)
        this.draw(this.elapsedMs / this.timestep, this.entityList); // Desenha (draw)

        // Pede o próximo frame (loop)
        this.frameId = requestAnimationFrame((nextTimestamp) => {
            this.mainLoop(nextTimestamp);
        });
    }

    /**
     * O loop principal do jogo (Game Loop), que roda continuamente.
     */
    mainLoop(timestamp) {
        this.engineCycle(timestamp);
    }
} // <-- FIM DA CLASSE GAMEENGINE


// =================================================================================
// CLASSE DAS BOLINHAS E FRUTAS (Pickup)
// Controla a lógica de colisão e pontuação das bolinhas e frutas.
// =================================================================================
class Pickup {
    constructor(type, scaledTileSize, column, row, pacman, mazeDiv, points) {
        this.type = type; // 'pacdot', 'powerPellet' ou 'fruit'
        this.pacman = pacman;
        this.mazeDiv = mazeDiv;
        this.points = points;
        this.nearPacman = false; // Flag de otimização

        // Mapeia os pontos da fruta para a imagem correta
        this.fruitImages = {
            100: 'cherry',
            300: 'strawberry',
            500: 'orange',
            700: 'apple',
            1000: 'melon',
            2000: 'galaxian',
            3000: 'bell',
            5000: 'key',
        };

        this.setStyleMeasurements(type, scaledTileSize, column, row, points);
    }

    /** Reseta a bolinha (a torna visível). */
    reset() {
        this.animationTarget.style.visibility = (this.type === 'fruit')
                ? 'hidden' : 'visible'; // Fruta começa escondida
    }

    /** Define o tamanho e posição (CSS) da bolinha/fruta. */
    setStyleMeasurements(type, scaledTileSize, column, row, points) {
        if (type === 'pacdot') { // Bolinha pequena
            this.size = scaledTileSize * 0.25;
            this.x = (column * scaledTileSize) + ((scaledTileSize / 8) * 3);
            this.y = (row * scaledTileSize) + ((scaledTileSize / 8) * 3);
        } else if (type === 'powerPellet') { // Pílula grande
            this.size = scaledTileSize;
            this.x = (column * scaledTileSize);
            this.y = (row * scaledTileSize);
        } else { // Fruta
            this.size = scaledTileSize * 2;
            this.x = (column * scaledTileSize) - (scaledTileSize * 0.5);
            this.y = (row * scaledTileSize) - (scaledTileSize * 0.5);
        }

        // Posição central (usada para checar a proximidade)
        this.center = {
            x: column * scaledTileSize,
            y: row * scaledTileSize,
        };

        // Cria a 'div' da bolinha no HTML
        this.animationTarget = document.createElement('div');
        this.animationTarget.style.position = 'absolute';
        this.animationTarget.style.backgroundSize = `${this.size}px`;
        this.animationTarget.style.backgroundImage = this.determineImage(
                type, points,
                );
        this.animationTarget.style.height = `${this.size}px`;
        this.animationTarget.style.width = `${this.size}px`;
        this.animationTarget.style.top = `${this.y}px`;
        this.animationTarget.style.left = `${this.x}px`;
        this.mazeDiv.appendChild(this.animationTarget);

        // Se for pílula de poder, adiciona a classe 'power-pellet' (para piscar)
        if (type === 'powerPellet') {
            this.animationTarget.classList.add('power-pellet');
        }

        this.reset();
    }

    /** Decide qual imagem (sprite) usar. */
    determineImage(type, points) {
        let image = '';

        if (type === 'fruit') {
            image = this.fruitImages[points] || 'cherry'; // Pega a fruta ou a cereja
        } else {
            image = type; // 'pacdot' ou 'powerPellet'
        }

        return `url(app/style/graphics/spriteSheets/pickups/${image}.svg)`;
    }

    /** Mostra a fruta na tela. */
    showFruit(points) {
        this.points = points;
        this.animationTarget.style.backgroundImage = this.determineImage(
                this.type, points,
                );
        this.animationTarget.style.visibility = 'visible';
    }

    /** Esconde a fruta. */
    hideFruit() {
        this.animationTarget.style.visibility = 'hidden';
    }

    /**
     * Checa a colisão do Pacman com a bolinha.
     * @param {Object} pickup - Posição e tamanho da bolinha.
     * @param {Object} originalPacman - Posição e tamanho do Pacman.
     * @returns {boolean} - True se colidiram.
     */
    checkForCollision(pickup, originalPacman) {
        const pacman = Object.assign({}, originalPacman);

        // Cria um "hitbox" (caixa de colisão) menor no centro do Pacman
        pacman.x += (pacman.size * 0.25);
        pacman.y += (pacman.size * 0.25);
        pacman.size /= 2;

        // Lógica de colisão de duas caixas (AABB)
        return (pickup.x < pacman.x + pacman.size
                && pickup.x + pickup.size > pacman.x
                && pickup.y < pacman.y + pacman.size
                && pickup.y + pickup.size > pacman.y);
    }

    /**
     * Otimização: Verifica se o Pacman está PERTO o suficiente
     * para que uma colisão seja possível.
     */
    checkPacmanProximity(maxDistance, pacmanCenter, debugging) {
        if (this.animationTarget.style.visibility !== 'hidden') {
            // Calcula a distância
            const distance = Math.sqrt(
                    ((this.center.x - pacmanCenter.x) ** 2)
                    + ((this.center.y - pacmanCenter.y) ** 2),
                    );

            // Define a flag 'nearPacman' (perto)
            this.nearPacman = (distance <= maxDistance);

            if (debugging) {
                this.animationTarget.style.background = this.nearPacman
                        ? 'lime' : 'red';
            }
        }
    }

    /** Verifica se deve checar a colisão (se está visível E perto). */
    shouldCheckForCollision() {
        return this.animationTarget.style.visibility !== 'hidden'
                && this.nearPacman;
    }

    /**
     * Chamado a cada frame pelo GameEngine.
     * Checa a colisão e dispara os eventos ('awardPoints', 'dotEaten', 'powerUp').
     */
    update() {
        // Otimização: Só checa colisão se o Pacman estiver perto
        if (this.shouldCheckForCollision()) {
            if (this.checkForCollision(
                    {
                        x: this.x,
                        y: this.y,
                        size: this.size,
                    }, {
                x: this.pacman.position.left,
                y: this.pacman.position.top,
                size: this.pacman.measurement,
            },
                    )) {
                // Se colidiu:
                this.animationTarget.style.visibility = 'hidden'; // Esconde a bolinha
                
                // Dispara o evento para dar pontos
                window.dispatchEvent(new CustomEvent('awardPoints', {
                    detail: {
                        points: this.points,
                        type: this.type,
                    },
                }));

                if (this.type === 'pacdot') {
                    // Avisa o Coordenador que uma bolinha foi comida
                    window.dispatchEvent(new Event('dotEaten'));
                } else if (this.type === 'powerPellet') {
                    // Avisa que a pílula de poder foi comida
                    window.dispatchEvent(new Event('dotEaten'));
                    window.dispatchEvent(new Event('powerUp'));
                }
            }
        }
    }
} // <-- FIM DA CLASSE PICKUP


// =================================================================================
// CLASSE DE UTILIDADES (CharacterUtil)
// Funções matemáticas de ajuda (cálculo de grid, direções, etc.)
// =================================================================================
class CharacterUtil {
    constructor() {
        // Objeto prático para evitar erros de digitação (ex: 'lef' em vez de 'left')
        this.directions = {
            up: 'up',
            down: 'down',
            left: 'left',
            right: 'right',
        };
    }

    /**
     * Evita "stutter" (gagueira) na animação.
     * Se o personagem "pular" muitos pixels em 1 frame, esconde ele
     * temporariamente (porque o navegador está atrasado).
     */
    checkForStutter(position, oldPosition) {
        let stutter = false;
        const threshold = 5; // Limite de 5 pixels

        if (position && oldPosition) {
            if (Math.abs(position.top - oldPosition.top) > threshold
                    || Math.abs(position.left - oldPosition.left) > threshold) {
                stutter = true;
            }
        }

        return stutter ? 'hidden' : 'visible';
    }

    /** Retorna qual propriedade CSS (top ou left) deve ser mudada. */
    getPropertyToChange(direction) {
        switch (direction) {
            case this.directions.up:
            case this.directions.down:
                return 'top';
            default:
                return 'left';
        }
    }

    /** Retorna a velocidade como positiva (down/right) ou negativa (up/left). */
    getVelocity(direction, velocityPerMs) {
        switch (direction) {
            case this.directions.up:
            case this.directions.left:
                return velocityPerMs * -1;
            default:
                return velocityPerMs;
        }
    }

    /**
     * Calcula a Posição de "Desenho" (Draw).
     * Interpola (suaviza) o movimento entre a posição lógica antiga e a nova.
     */
    calculateNewDrawValue(interp, prop, oldPosition, position) {
        return oldPosition[prop] + (position[prop] - oldPosition[prop]) * interp;
    }

    /**
     * Converte a Posição de pixels (ex: 286px) para Posição de Grid (ex: 13.5).
     * @param {Object} position - {top, left} em pixels.
     * @param {number} scaledTileSize - Tamanho do bloco.
     * @returns {Object} - {x, y} em grid.
     */
    determineGridPosition(position, scaledTileSize) {
        return {
            x: (position.left / scaledTileSize) + 0.5,
            y: (position.top / scaledTileSize) + 0.5,
        };
    }

    /** Verifica se o jogador quer dar meia-volta. */
    turningAround(direction, desiredDirection) {
        return desiredDirection === this.getOppositeDirection(direction);
    }

    /** Retorna a direção oposta. */
    getOppositeDirection(direction) {
        switch (direction) {
            case this.directions.up:
                return this.directions.down;
            case this.directions.down:
                return this.directions.up;
            case this.directions.left:
                return this.directions.right;
            default:
                return this.directions.left;
        }
    }

    /**
     * Decide se deve arredondar para Cima (ceil) ou para Baixo (floor)
     * ao checar colisão com paredes, baseado na direção.
     */
    determineRoundingFunction(direction) {
        switch (direction) {
            case this.directions.up:
            case this.directions.left:
                return Math.floor; // Se vai para cima/esquerda, arredonda para baixo
            default:
                return Math.ceil; // Se vai para baixo/direita, arredonda para cima
        }
    }

    /** Verifica se o personagem está cruzando para um novo "bloco" do grid. */
    changingGridPosition(oldPosition, position) {
        return (
                Math.floor(oldPosition.x) !== Math.floor(position.x)
                || Math.floor(oldPosition.y) !== Math.floor(position.y)
                );
    }

    /**
     * Verifica se o "bloco" (tile) para onde o personagem quer ir é uma parede ('X').
     */
    checkForWallCollision(desiredNewGridPosition, mazeArray, direction) {
        const roundingFunction = this.determineRoundingFunction(
                direction, this.directions,
                );

        const desiredX = roundingFunction(desiredNewGridPosition.x);
        const desiredY = roundingFunction(desiredNewGridPosition.y);
        let newGridValue;

        if (Array.isArray(mazeArray[desiredY])) {
            newGridValue = mazeArray[desiredY][desiredX];
        }

        return (newGridValue === 'X'); // Retorna true se for uma parede
    }
/**
     * Retorna um objeto com a nova Posição (pixels) e Posição do Grid (blocos)
     * para onde o personagem vai se mover.
     */
    determineNewPositions(
            position, direction, velocityPerMs, elapsedMs, scaledTileSize,
            ) {
        const newPosition = Object.assign({}, position);
        // Calcula o novo pixel (ex: 286px + (0.1 * 16.6ms) = 287.66px)
        newPosition[this.getPropertyToChange(direction)]
                += this.getVelocity(direction, velocityPerMs) * elapsedMs;
        
        // Calcula o novo grid (ex: {x: 13.5, y: 11.2})
        const newGridPosition = this.determineGridPosition(
                newPosition, scaledTileSize,
                );

        return {
            newPosition,
            newGridPosition,
        };
    }

    /**
     * "Trava" (Snap) o personagem na posição exata do "bloco" do grid.
     * @returns {Object} - A posição {top, left} em pixels, perfeitamente alinhada.
     */
    snapToGrid(position, direction, scaledTileSize) {
        const newPosition = Object.assign({}, position);
        const roundingFunction = this.determineRoundingFunction(
                direction, this.directions,
                );

        // Arredonda a posição do grid (ex: 13.8 -> 14)
        switch (direction) {
            case this.directions.up:
            case this.directions.down:
                newPosition.y = roundingFunction(newPosition.y);
                break;
            default:
                newPosition.x = roundingFunction(newPosition.x);
                break;
        }

        // Converte a posição do grid (ex: 14) de volta para pixels (ex: 308px)
        return {
            top: (newPosition.y - 0.5) * scaledTileSize,
            left: (newPosition.x - 0.5) * scaledTileSize,
        };
    }

    /**
     * Lida com o "teleporte" do túnel lateral.
     * @returns {Object} - A nova posição {top, left} (do outro lado do mapa).
     */
    handleWarp(position, scaledTileSize, mazeArray) {
        const newPosition = Object.assign({}, position);
        const gridPosition = this.determineGridPosition(position, scaledTileSize);

        // Se saiu pela esquerda
        if (gridPosition.x < -0.75) {
            newPosition.left = (scaledTileSize * (mazeArray[0].length - 0.75));
        } 
        // Se saiu pela direita
        else if (gridPosition.x > (mazeArray[0].length - 0.25)) {
            newPosition.left = (scaledTileSize * -1.25);
        }

        return newPosition;
    }

    /**
     * Avança o frame da animação (sprite sheet).
     * @param {Object} character - O personagem (Pacman ou Fantasma).
     * @returns {Object} - As propriedades atualizadas da animação.
     */
    advanceSpriteSheet(character) {
        const {
            msSinceLastSprite,
            animationTarget,
            backgroundOffsetPixels,
        } = character;
        const updatedProperties = {
            msSinceLastSprite,
            animationTarget,
            backgroundOffsetPixels,
        };

        // Verifica se já deu o tempo de trocar o frame
        const ready = (character.msSinceLastSprite > character.msBetweenSprites)
                && character.animate;
        if (ready) {
            updatedProperties.msSinceLastSprite = 0; // Zera o contador

            // Se não for o último frame da animação
            if (character.backgroundOffsetPixels
                    < (character.measurement * (character.spriteFrames - 1))
                    ) {
                // Move o "background-position" para o próximo frame
                updatedProperties.backgroundOffsetPixels += character.measurement;
            } 
            // Se for o último frame e a animação for um loop
            else if (character.loopAnimation) {
                updatedProperties.backgroundOffsetPixels = 0; // Volta ao primeiro frame
            }

            // Define o CSS 'background-position' (ex: '-44px 0px')
            const style = `-${updatedProperties.backgroundOffsetPixels}px 0px`;
            updatedProperties.animationTarget.style.backgroundPosition = style;
        }

        return updatedProperties;
    }
} // <-- FIM DA CLASSE CHARACTERUTIL


// Funções de áudio (legado) que não estão dentro de uma classe
var muteAll = function () {
    var audios = document.getElementsByClassName("audioS");
    var i;
    for (i = 0; i < audios.length; i++) {
        audios[i].volume = 0;
    }
}
// ... (outras funções de áudio legado) ...
var toLog = function (text) {
    var log = document.getElementById('log');
    log.insertAdjacentHTML('beforeend', text + '<br/>');
}


// =================================================================================
// CLASSE DO GERENCIADOR DE SOM (SoundManager)
// Controla todos os sons que NÃO são do Safari (ex: Chrome, Firefox)
// =================================================================================
class SoundManager {
    constructor() {
        this.baseUrl = 'app/style/audio/';
        this.fileFormat = 'mp3';
        this.masterVolume = 1; // Volume principal (0 = mudo, 1 = 100%)
        this.paused = false;
        this.cutscene = true; // Flag para não tocar sirene durante o "Ready!"

        // Inicia a API de Áudio (Web Audio API)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ambience = new AudioContext();
    }
/**
     * Define a flag de "cutscene" (para não tocar sirene durante o "Ready!").
     * @param {boolean} newValue - True se for cutscene, false se for gameplay.
     */
    setCutscene(newValue) {
        this.cutscene = newValue;
    }

    /**
     * Define o volume principal (Master) do jogo.
     * @param {0|1} newVolume - 0 (mudo) ou 1 (normal).
     */
    setMasterVolume(newVolume) {
        this.masterVolume = newVolume;

        // Atualiza o volume de qualquer som que já estiver tocando
        if (this.soundEffect) {
            this.soundEffect.volume = this.masterVolume;
        }

        if (this.dotPlayer) {
            this.dotPlayer.volume = this.masterVolume;
        }

        // Se o volume for 0 (Mudo), para a sirene (ambiente)
        if (this.masterVolume === 0) {
            this.stopAmbience();
        } else {
        // Se o volume for 1 (Normal), volta a tocar a sirene
            this.resumeAmbience(this.paused);
        }
    }

    /**
     * Toca um som de "efeito" (curto, não-looping).
     * Ex: 'death.mp3', 'eat_ghost.mp3', 'fruit.mp3'.
     * @param {string} sound - O nome do arquivo (sem .mp3).
     */
    play(sound) {
        // Se for Safari, usa a função "legado"
        if (isSafari()) {
            playSound(sound);
        } else {
            // Se for Chrome/outro, cria um novo <audio>
            this.soundEffect = new Audio(`${this.baseUrl}${sound}.${this.fileFormat}`);
            this.soundEffect.volume = this.masterVolume;
            this.soundEffect.play();
        }
    }

    /**
     * Lógica especial para o "waka-waka" (comer bolinhas).
     * Alterna entre 'dot_1.mp3' e 'dot_2.mp3' para não ficar repetitivo.
     * Também evita que os sons se sobreponham (um "corta" o outro).
     */
    playDotSound() {
        this.queuedDotSound = true; // Marca que uma bolinha foi comida

        // Se NENHUM som de "dot" estiver tocando agora...
        if (!this.dotPlayer) {

            this.queuedDotSound = false; // "Limpa" a fila
            // Alterna o som (1 vira 2, 2 vira 1)
            this.dotSound = (this.dotSound === 1) ? 2 : 1;

            if (isSafari()) {
                playSound('dot_' + this.dotSound);
            } else {
                // Toca o som (dot_1 ou dot_2)
                this.dotPlayer = new Audio(
                        `${this.baseUrl}dot_${this.dotSound}.${this.fileFormat}`,
                        );
                // Quando o som ACABAR, chama 'dotSoundEnded'
                this.dotPlayer.onended = this.dotSoundEnded.bind(this);
                this.dotPlayer.volume = this.masterVolume;
                this.dotPlayer.play();
            }
        }
    }

    /**
     * Chamado quando o som "waka-waka" termina.
     */
    dotSoundEnded() {
        this.dotPlayer = undefined; // Libera o "tocador"

        // Se o jogador comeu outra bolinha ENQUANTO o som tocava...
        if (this.queuedDotSound) {
            this.playDotSound(); // ...toca o próximo som da fila.
        }
    }

    /**
     * Define o som de ambiente (a sirene, o "power up", ou os "olhos").
     * @param {string} sound - O nome do arquivo de som (ex: 'siren_1').
     * @param {boolean} keepCurrentAmbience - (Usado pelo Pause)
     */
    async setAmbience(sound, keepCurrentAmbience) {
        // Só toca se não estiver baixando outro som e se não for uma "cutscene"
        if (!this.fetchingAmbience && !this.cutscene) {
            if (!keepCurrentAmbience) {
                this.currentAmbience = sound; // Salva o som atual (ex: 'siren_1')
                this.paused = false;
            } else {
                this.paused = true; // (Usado pelo Pause)
            }

            // Para o som de sirene anterior (se estiver tocando)
            if (isSafari()) {
                if ( ambS!=undefined ) {
                    ambS.disconnect();
                    ambS.stop(0);
                    ambS = null;
                }
            } else {
                if (this.ambienceSource) {
                    this.ambienceSource.stop();
                }
            }

            // Se o volume não estiver no mudo
            if (this.masterVolume !== 0) {
                this.fetchingAmbience = true; // Trava para não baixar dois ao mesmo tempo

                if (isSafari()) {
                    // Lógica do Safari (usa a função global)
                    playSoundLoop(sound);
                    this.fetchingAmbience = false;
                } else {
                    // Lógica do Chrome (Web Audio API - mais moderna)
                    // 1. Baixa o arquivo de som
                    const response = await fetch(
                            `${this.baseUrl}${sound}.${this.fileFormat}`,
                            );
                    const arrayBuffer = await response.arrayBuffer();
                    // 2. "Decodifica" o .mp3
                    const audioBuffer = await this.ambience.decodeAudioData(arrayBuffer);

                    // 3. Toca o som em loop
                    this.ambienceSource = this.ambience.createBufferSource();
                    this.ambienceSource.buffer = audioBuffer;
                    this.ambienceSource.connect(this.ambience.destination);
                    this.ambienceSource.loop = true;
                    this.ambienceSource.start();
                    this.fetchingAmbience = false; // Libera a trava
                }
            }
        }
    }
/**
     * "Despausa" o som de ambiente (a sirene).
     */
    resumeAmbience(paused) {
        if (this.ambienceSource || ambS) {
            // A API de Áudio do Chrome não tem "resume".
            // Você tem que parar o som antigo e tocar o som de novo.
            if (paused) {
                // Se estava pausado, volta a tocar a "batida" do pause
                this.setAmbience('pause_beat', true);
            } else {
                // Se estava jogando, volta a tocar a sirene atual
                this.setAmbience(this.currentAmbience);
            }
        }
    }

    /**
     * Para o som de ambiente (sirene) completamente.
     */
    stopAmbience() {
        if (isSafari()) {
            // Lógica do Safari
            if( ambS!=undefined ) {
                ambS.disconnect();
                ambS.stop(0);
                ambS = null;
            }
        } else {
            // Lógica do Chrome
            if (this.ambienceSource) {
                this.ambienceSource.stop();
            }
        }
    }
} // <-- FIM DA CLASSE SOUNDMANAGER


// =================================================================================
// CLASSE DO "TIMER" (setTimeout inteligente)
// Permite pausar e resumir um setTimeout.
// Essencial para o "Ready!", duração do "power up", e animação de morte.
// =================================================================================
class Timer {
    /**
     * Cria um novo Timer.
     * @param {function} callback - A função que será chamada quando o tempo acabar.
     * @param {number} delay - O tempo em milissegundos (ms).
     */
    constructor(callback, delay) {
        this.callback = callback;
        this.remaining = delay; // Tempo restante
        this.resume(); // Inicia o timer
    }

    /**
     * Pausa o timer (chamado pelo 'handlePauseKey').
     * @param {boolean} systemPause - True se foi o sistema que pausou.
     */
    pause(systemPause) {
        window.clearTimeout(this.timerId); // Cancela o setTimeout atual
        // Calcula quanto tempo faltava
        this.remaining -= new Date() - this.start; 
        this.oldTimerId = this.timerId;

        if (systemPause) {
            this.pausedBySystem = true;
        }
    }

    /**
     * "Despausa" o timer.
     * Cria um *novo* setTimeout apenas com o tempo que faltava ('this.remaining').
     * @param {boolean} systemResume - True se foi o sistema que despausou.
     */
    resume(systemResume) {
        // Se o sistema está despausando, ou se o jogador pausou (e não o sistema)
        if (systemResume || !this.pausedBySystem) {
            this.pausedBySystem = false;

            this.start = new Date(); // Marca a hora que "despausou"
            // Cria o novo setTimeout só com o tempo restante
            this.timerId = window.setTimeout(() => {
                this.callback(); // Chama a função original (ex: 'startGameplay')
                // Avisa o GameCoordinator para remover este timer da lista
                window.dispatchEvent(new CustomEvent('removeTimer', {
                    detail: {
                        timer: this,
                    },
                }));
            }, this.remaining);

            // Se for um timer novo (não um "resume"), avisa o GameCoordinator
            // para adicioná-lo na lista de timers ativos.
            if (!this.oldTimerId) {
                window.dispatchEvent(new CustomEvent('addTimer', {
                    detail: {
                        timer: this,
                    },
                }));
            }
        }
    }
} // <-- FIM DA CLASSE TIMER
