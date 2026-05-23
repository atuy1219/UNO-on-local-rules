import React, { useState, useEffect, useRef } from 'react';

// --- カード定義とユーティリティ ---
const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTIONS = ['skip', 'reverse', 'draw2'];
const WILDS = ['wild', 'draw4'];

const createDeck = () => {
  let deck = [];
  let idCounter = 0;
  COLORS.forEach(color => {
    deck.push({ id: idCounter++, color, value: '0', type: 'number' });
    [...NUMBERS.slice(1), ...ACTIONS].forEach(value => {
      deck.push({ id: idCounter++, color, value, type: ACTIONS.includes(value) ? value : 'number' });
      deck.push({ id: idCounter++, color, value, type: ACTIONS.includes(value) ? value : 'number' });
    });
  });
  WILDS.forEach(value => {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: idCounter++, color: 'black', value, type: value });
    }
  });
  return shuffle(deck);
};

const shuffle = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function App() {
  const [gameState, setGameState] = useState('setup');
  const [playerCount, setPlayerCount] = useState(4);
  
  const [rouletteAngle, setRouletteAngle] = useState(0);
  const [rouletteResult, setRouletteResult] = useState(null);

  const [deck, setDeck] = useState([]);
  const [discardPile, setDiscardPile] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [turnCount, setTurnCount] = useState(0); 
  const [direction, setDirection] = useState(1); 
  const [currentColor, setCurrentColor] = useState('');
  const [drawStack, setDrawStack] = useState(0);
  const [drawStackType, setDrawStackType] = useState(null);

  const [selectedCards, setSelectedCards] = useState([]); 
  const [messages, setMessages] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingPlay, setPendingPlay] = useState(null);
  const [pendingDrawnCard, setPendingDrawnCard] = useState(null); 
  const [ranks, setRanks] = useState([]); 

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const addMessage = (msg) => {
    setMessages(prev => [...prev.slice(-10), msg]); 
  };

  const handlePlayerCountSelect = (count) => {
    setPlayerCount(count);
    setGameState('roulette');
    setRouletteAngle(0);
    setRouletteResult(null);
  };

  const startRoulette = () => {
    const targetIndex = Math.floor(Math.random() * playerCount);
    const targetDegrees = (360 / playerCount) * targetIndex;
    const totalRotation = 360 * 5 + targetDegrees; 

    setRouletteAngle(totalRotation);

    setTimeout(() => {
      const playersList = [{name: 'あなた', index: 0}];
      for(let i=1; i<playerCount; i++) playersList.push({name: `CPU ${i}`, index: i});
      
      setRouletteResult({
        message: `${playersList[targetIndex].name} からスタートします！`,
        startIndex: targetIndex
      });

      setTimeout(() => {
        startNewGame(targetIndex);
      }, 2000);
    }, 3000); 
  };

  const startNewGame = (startIndex = 0) => {
    let initialDeck = createDeck();
    
    let firstCardIndex = initialDeck.findIndex(c => c.type === 'number');
    let firstCard = initialDeck.splice(firstCardIndex, 1)[0];

    const initialPlayers = [{ id: 'player', name: 'あなた', isUser: true, hand: [], isOut: false, index: 0 }];
    for (let i = 1; i < playerCount; i++) {
      initialPlayers.push({ id: `cpu${i}`, name: `CPU ${i}`, isUser: false, hand: [], isOut: false, index: i });
    }

    initialPlayers.forEach(p => {
      p.hand = initialDeck.splice(0, 7);
    });

    setDeck(initialDeck);
    setDiscardPile([firstCard]);
    setCurrentColor(firstCard.color);
    setPlayers(initialPlayers);
    setCurrentPlayerIndex(startIndex);
    setTurnCount(0);
    setDirection(1);
    setDrawStack(0);
    setDrawStackType(null);
    setGameOver(false);
    setSelectedCards([]);
    setPendingDrawnCard(null);
    setRanks([]);
    setMessages(['ゲーム開始！最初のカードは ' + getCardName(firstCard)]);
    setGameState('playing');
  };

  const getCardName = (card) => {
    const colorNames = { red: '赤', blue: '青', green: '緑', yellow: '黄', black: '' };
    const valueNames = { skip: 'スキップ', reverse: 'リバース', draw2: 'ドロー2', wild: 'ワイルド', draw4: 'ドロー4' };
    return `${colorNames[card.color]} ${valueNames[card.value] || card.value}`.trim();
  };

  const advanceTurn = (nextIndex) => {
    setCurrentPlayerIndex(nextIndex);
    setTurnCount(prev => prev + 1);
  };

  const getNextPlayerIndex = (currentIndex, dir, skipCount = 0, currentPlayers = players) => {
    let nextIdx = currentIndex;
    let steps = 1 + skipCount;
    while (steps > 0) {
      nextIdx = (nextIdx + dir + currentPlayers.length) % currentPlayers.length;
      if (!currentPlayers[nextIdx].isOut) {
        steps--;
      }
    }
    return nextIdx;
  };

  const drawCards = (currentDeck, currentDiscard, count) => {
    let drawn = [];
    let newDeck = [...currentDeck];
    let newDiscard = [...currentDiscard];

    for (let i = 0; i < count; i++) {
      if (newDeck.length === 0) {
        if (newDiscard.length <= 1) break; 
        const topCard = newDiscard.pop();
        newDeck = shuffle(newDiscard);
        newDiscard = [topCard];
        addMessage("山札を再シャッフルしました");
      }
      drawn.push(newDeck.pop());
    }
    return { drawn, newDeck, newDiscard };
  };

  const canPlayCard = (card, currentTopCard, currentColor, drawStackAmount, stackType) => {
    if (drawStackAmount > 0) {
      if (stackType === 'draw2') return card.type === 'draw2' || card.type === 'draw4';
      if (stackType === 'draw4') return card.type === 'draw4';
      return false;
    }
    if (card.color === 'black') return true; 
    if (card.color === currentColor) return true; 
    if (card.value === currentTopCard.value) return true; 
    return false;
  };

  const executePlay = (playerIndex, cardsToPlay, chosenColor) => {
    const activePlayersCountBefore = players.filter(p => !p.isOut).length;
    const player = players[playerIndex];
    let newPlayers = [...players];
    let newDiscard = [...discardPile, ...cardsToPlay];
    
    const playedCardIds = cardsToPlay.map(c => c.id);
    newPlayers[playerIndex] = {
      ...player,
      hand: player.hand.filter(c => !playedCardIds.includes(c.id))
    };

    const count = cardsToPlay.length;
    const baseCard = cardsToPlay[0];
    let nextColor = chosenColor || (baseCard.color !== 'black' ? cardsToPlay[cardsToPlay.length - 1].color : 'black'); 
    let newDirection = direction;
    let newDrawStack = drawStack;
    let newStackType = drawStackType;
    let skipCount = 0;

    addMessage(`${player.name} が ${count}枚出しました: ${cardsToPlay.map(getCardName).join(', ')}`);

    if (baseCard.type === 'skip') {
      skipCount = count;
    } else if (baseCard.type === 'reverse') {
      if (count % 2 !== 0) {
        newDirection *= -1;
      }
    } else if (baseCard.type === 'draw2') {
      newDrawStack += 2 * count;
      newStackType = 'draw2';
    } else if (baseCard.type === 'draw4') {
      newDrawStack += 4 * count;
      newStackType = 'draw4';
    }

    if (chosenColor) {
      nextColor = chosenColor;
      addMessage(`色は ${getCardName({color: chosenColor, value:''})} に指定されました`);
    }

    let updatedRanks = [...ranks];
    if (newPlayers[playerIndex].hand.length === 0) {
      newPlayers[playerIndex].isOut = true;
      updatedRanks.push(player.name);
      addMessage(`🎉 ${player.name} が上がりました！ (${updatedRanks.length}位)`);
    } else if (newPlayers[playerIndex].hand.length === 1) {
      addMessage(`⚠️ ${player.name} がUNOを宣言！`);
    }

    const activePlayersCountAfter = newPlayers.filter(p => !p.isOut).length;
    if (activePlayersCountAfter <= 1) {
      const lastPlayer = newPlayers.find(p => !p.isOut);
      if (lastPlayer) updatedRanks.push(lastPlayer.name);
      
      setPlayers(newPlayers);
      setDiscardPile(newDiscard);
      setCurrentColor(nextColor);
      setRanks(updatedRanks);
      setGameOver(true);
      addMessage(`ゲーム終了！`);
      return;
    }

    setPlayers(newPlayers);
    setDiscardPile(newDiscard);
    setCurrentColor(nextColor);
    setDirection(newDirection);
    setDrawStack(newDrawStack);
    setDrawStackType(newStackType);
    setRanks(updatedRanks);

    let nextIndex;
    if (activePlayersCountBefore === 2 && (baseCard.type === 'skip' || baseCard.type === 'reverse') && !newPlayers[playerIndex].isOut) {
      nextIndex = playerIndex;
    } else {
      nextIndex = getNextPlayerIndex(playerIndex, newDirection, skipCount, newPlayers);
    }
    
    advanceTurn(nextIndex);
  };

  const executeDraw = (playerIndex) => {
    const player = players[playerIndex];
    let drawCount = drawStack > 0 ? drawStack : 1;
    
    const { drawn, newDeck, newDiscard } = drawCards(deck, discardPile, drawCount);
    
    let newPlayers = [...players];
    newPlayers[playerIndex] = {
      ...player,
      hand: [...player.hand, ...drawn]
    };

    if (drawStack > 0) {
      addMessage(`${player.name} はペナルティで ${drawCount}枚 引きました`);
    } else {
      addMessage(`${player.name} は 1枚 引きました`);
    }

    setDeck(newDeck);
    setDiscardPile(newDiscard);
    setPlayers(newPlayers);
    setDrawStack(0);
    setDrawStackType(null);

    const nextIndex = getNextPlayerIndex(playerIndex, direction, 0, newPlayers);
    advanceTurn(nextIndex);
  };

  const handleCardSelect = (card) => {
    if (players[currentPlayerIndex].id !== 'player') return;

    setSelectedCards(prev => {
      if (prev.includes(card.id)) return prev.filter(id => id !== card.id);
      if (prev.length > 0) {
        const firstSelectedCard = players[0].hand.find(c => c.id === prev[0]);
        if (firstSelectedCard.value !== card.value) return [card.id];
      }
      return [...prev, card.id];
    });
  };

  const handlePlaySelected = () => {
    if (selectedCards.length === 0) return;
    const playerHand = players[0].hand;
    const cardsToPlay = selectedCards.map(id => playerHand.find(c => c.id === id));
    
    const baseCard = cardsToPlay[0];
    const topCard = discardPile[discardPile.length - 1];

    if (!canPlayCard(baseCard, topCard, currentColor, drawStack, drawStackType)) {
      alert("そのカードは出せません");
      return;
    }

    setSelectedCards([]);

    if (baseCard.color === 'black') {
      setPendingPlay({ playerIndex: 0, cards: cardsToPlay });
      setShowColorPicker(true);
    } else {
      executePlay(0, cardsToPlay, null);
    }
  };

  const handleUserDraw = () => {
    setSelectedCards([]);
    
    if (drawStack > 0) {
      executeDraw(0);
    } else {
      const { drawn, newDeck, newDiscard } = drawCards(deck, discardPile, 1);
      const drawnCard = drawn[0];
      
      let newPlayers = [...players];
      newPlayers[0] = { ...newPlayers[0], hand: [...newPlayers[0].hand, drawnCard] };
      
      setDeck(newDeck);
      setDiscardPile(newDiscard);
      setPlayers(newPlayers);
      addMessage(`あなたは 1枚 引きました`);

      const topCard = discardPile[discardPile.length - 1];
      
      if (canPlayCard(drawnCard, topCard, currentColor, 0, null)) {
        setPendingDrawnCard(drawnCard);
      } else {
        const nextIndex = getNextPlayerIndex(0, direction, 0, newPlayers);
        advanceTurn(nextIndex);
      }
    }
  };

  const handleColorSelect = (color) => {
    setShowColorPicker(false);
    if (pendingPlay) {
      executePlay(pendingPlay.playerIndex, pendingPlay.cards, color);
      setPendingPlay(null);
    }
  };

  useEffect(() => {
    if (gameState !== 'playing' || players.length === 0 || gameOver || showColorPicker || pendingDrawnCard) return;
    
    const currentPlayer = players[currentPlayerIndex];

    if (!currentPlayer.isUser) {
      const cpuSpeed = players[0].isOut ? 100 : 1000;
      
      const timer = setTimeout(() => {
        playCPUTurn(currentPlayerIndex);
      }, cpuSpeed);
      return () => clearTimeout(timer);
    }
  }, [turnCount, gameOver, showColorPicker, pendingDrawnCard, gameState]);

  const playCPUTurn = (cpuIndex) => {
    const cpu = players[cpuIndex];
    const topCard = discardPile[discardPile.length - 1];
    const playableCards = cpu.hand.filter(c => canPlayCard(c, topCard, currentColor, drawStack, drawStackType));

    if (playableCards.length > 0) {
      const targetCard = playableCards[Math.floor(Math.random() * playableCards.length)];
      const cardsToPlay = cpu.hand.filter(c => c.value === targetCard.value);

      if (targetCard.color === 'black') {
        const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
        cpu.hand.forEach(c => { if (c.color !== 'black') colorCounts[c.color]++; });
        const chosenColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
        executePlay(cpuIndex, cardsToPlay, chosenColor);
      } else {
        executePlay(cpuIndex, cardsToPlay, null);
      }
    } else {
      if (drawStack > 0) {
        executeDraw(cpuIndex);
      } else {
        const { drawn, newDeck, newDiscard } = drawCards(deck, discardPile, 1);
        const drawnCard = drawn[0];
        
        let newPlayers = [...players];
        newPlayers[cpuIndex] = { ...cpu, hand: [...cpu.hand, drawnCard] };

        addMessage(`${cpu.name} は 1枚 引きました`);

        if (canPlayCard(drawnCard, topCard, currentColor, 0, null)) {
          const activePlayersCountBefore = players.filter(p => !p.isOut).length;
          
          let nextPlayers = [...newPlayers];
          nextPlayers[cpuIndex].hand = nextPlayers[cpuIndex].hand.filter(c => c.id !== drawnCard.id); 
          
          let nextDiscard = [...newDiscard, drawnCard];
          let nextColor = drawnCard.color;
          
          if (nextColor === 'black') {
              const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
              nextPlayers[cpuIndex].hand.forEach(c => { if (c.color !== 'black') colorCounts[c.color]++; });
              nextColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
              addMessage(`色は ${getCardName({color: nextColor, value:''})} に指定されました`);
          }

          let nextDirection = direction;
          let nextDrawStack = drawStack;
          let nextStackType = drawStackType;
          let skipCount = 0;

          if (drawnCard.type === 'skip') skipCount = 1;
          else if (drawnCard.type === 'reverse') nextDirection *= -1;
          else if (drawnCard.type === 'draw2') { nextDrawStack += 2; nextStackType = 'draw2'; }
          else if (drawnCard.type === 'draw4') { nextDrawStack += 4; nextStackType = 'draw4'; }

          addMessage(`${cpu.name} が引いたカードをそのまま出しました: ${getCardName(drawnCard)}`);

          let updatedRanks = [...ranks];
          if (nextPlayers[cpuIndex].hand.length === 0) {
            nextPlayers[cpuIndex].isOut = true;
            updatedRanks.push(cpu.name);
            addMessage(`🎉 ${cpu.name} が上がりました！`);
          } else if (nextPlayers[cpuIndex].hand.length === 1) {
            addMessage(`⚠️ ${cpu.name} がUNOを宣言！`);
          }

          const activePlayersCountAfter = nextPlayers.filter(p => !p.isOut).length;
          if (activePlayersCountAfter <= 1) {
              setPlayers(nextPlayers);
              setDiscardPile(nextDiscard);
              setCurrentColor(nextColor);
              setRanks(updatedRanks);
              setGameOver(true);
              addMessage(`ゲーム終了！`);
              return;
          }

          setDeck(newDeck);
          setDiscardPile(nextDiscard);
          setPlayers(nextPlayers);
          setCurrentColor(nextColor);
          setDirection(nextDirection);
          setDrawStack(nextDrawStack);
          setDrawStackType(nextStackType);
          setRanks(updatedRanks);

          let nextIndex;
          if (activePlayersCountBefore === 2 && (drawnCard.type === 'skip' || drawnCard.type === 'reverse') && !nextPlayers[cpuIndex].isOut) {
              nextIndex = cpuIndex;
          } else {
              nextIndex = getNextPlayerIndex(cpuIndex, nextDirection, skipCount, nextPlayers);
          }
          advanceTurn(nextIndex);
          
        } else {
          setDeck(newDeck);
          setDiscardPile(newDiscard);
          setPlayers(newPlayers);
          const nextIndex = getNextPlayerIndex(cpuIndex, direction, 0, newPlayers);
          advanceTurn(nextIndex);
        }
      }
    }
  };

  const getColorClass = (color) => {
    switch (color) {
      case 'red': return 'bg-red-500';
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'black': return 'bg-gray-800';
      default: return 'bg-gray-300';
    }
  };

  const getTextColorClass = (color) => {
    switch (color) {
      case 'red': return 'text-red-500';
      case 'blue': return 'text-blue-500';
      case 'green': return 'text-green-500';
      case 'yellow': return 'text-yellow-500';
      case 'black': return 'text-gray-800';
      default: return 'text-gray-300';
    }
  };

  const CardRender = ({ card, onClick, isSelected, isFaceDown, size = "md", isPlayable = false, isMyTurn = false }) => {
    const sizes = {
      sm: "w-12 h-16 text-xs",
      md: "w-16 h-24 text-sm",
      lg: "w-24 h-36 text-xl"
    };
    
    if (isFaceDown) {
      return (
        <div className={`relative rounded-lg shadow-md border-2 border-white bg-gray-900 flex items-center justify-center ${sizes[size]} transform transition-transform`}>
          <div className="w-4/5 h-4/5 border-2 border-red-500 rounded-full flex items-center justify-center transform -rotate-45 bg-gray-800">
             <span className="text-red-500 font-bold italic tracking-tighter">UNO</span>
          </div>
        </div>
      );
    }

    const valueDisplay = () => {
      if (card.type === 'skip') return '⊘';
      if (card.type === 'reverse') return '⇄';
      if (card.type === 'draw2') return '+2';
      if (card.type === 'draw4') return '+4';
      if (card.type === 'wild') return 'W';
      return card.value;
    };

    let interactionClasses = "";
    if (isSelected) {
      interactionClasses = "-translate-y-6 shadow-[0_0_20px_rgba(255,255,255,0.8)] ring-4 ring-blue-400 z-20";
    } else if (isPlayable) {
      interactionClasses = "shadow-[0_0_15px_rgba(250,204,21,0.8)] ring-4 ring-yellow-400 z-10 hover:-translate-y-2 hover:shadow-[0_0_20px_rgba(250,204,21,1)]";
    } else if (isMyTurn) {
      interactionClasses = "opacity-50 hover:opacity-80";
    } else {
      interactionClasses = "hover:-translate-y-1 shadow-md";
    }

    return (
      <div 
        onClick={onClick}
        className={`relative rounded-lg border-2 border-white cursor-pointer select-none transition-all duration-200 ${sizes[size]} ${getColorClass(card.color)} ${interactionClasses}`}
      >
        <div className="absolute inset-1 bg-white rounded-full opacity-20 transform -rotate-[30deg] scale-110 pointer-events-none"></div>
        <div className="absolute inset-2 bg-white rounded-full opacity-90 flex items-center justify-center pointer-events-none shadow-inner transform -rotate-[20deg] scale-105">
           <span className={`font-black tracking-tighter ${getTextColorClass(card.color)} ${size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-lg'}`}>
            {valueDisplay()}
           </span>
        </div>
        <div className="absolute top-1 left-1 text-white font-bold text-[0.6rem] leading-none drop-shadow-md pointer-events-none">{valueDisplay()}</div>
        <div className="absolute bottom-1 right-1 text-white font-bold text-[0.6rem] leading-none rotate-180 drop-shadow-md pointer-events-none">{valueDisplay()}</div>
      </div>
    );
  };

  if (gameState === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-green-900 text-white font-sans p-4">
        <h1 className="text-5xl font-black mb-12 text-yellow-400 drop-shadow-lg tracking-tighter italic border-4 border-white p-4 rounded-xl bg-red-600 transform -rotate-6">UNO</h1>
        <div className="bg-white text-gray-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center">
          <h2 className="text-xl font-bold mb-6">プレイ人数を選択 (2〜6人)</h2>
          <div className="grid grid-cols-2 gap-4">
            {[2, 3, 4, 5, 6].map(count => (
              <button 
                key={count}
                onClick={() => handlePlayerCountSelect(count)}
                className={`bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-2 rounded-xl text-lg transition-transform active:scale-95 shadow-md ${count === 6 ? 'col-span-2' : ''}`}
              >
                {count} 人
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'roulette') {
    const playersList = [{name: 'あなた', index: 0}];
    for(let i=1; i<playerCount; i++) playersList.push({name: `CPU ${i}`, index: i});

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-green-900 text-white font-sans p-4">
        <h2 className="text-2xl font-bold mb-12 text-center h-16">
          {rouletteResult ? rouletteResult.message : 'スタートプレイヤーを決定します'}
        </h2>
        
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center rounded-full border-[6px] border-yellow-400 bg-black bg-opacity-40 shadow-[0_0_40px_rgba(250,204,21,0.4)]">
          {playersList.map((p, i) => {
            const angle = (360 / playerCount) * i - 90;
            return (
              <div 
                key={i} 
                className={`absolute font-bold text-xs sm:text-sm px-3 py-1 rounded-full border-2 ${p.index === 0 ? 'bg-yellow-400 text-black border-white z-10 scale-110' : 'bg-gray-800 text-white border-gray-600'} shadow-lg whitespace-nowrap`}
                style={{
                  transform: `rotate(${angle}deg) translate(110px) rotate(${-angle}deg)`
                }}
              >
                {p.name}
              </div>
            );
          })}

          <div 
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              transform: `rotate(${rouletteAngle}deg)`,
              transition: 'transform 3s cubic-bezier(0.1, 0.7, 0.1, 1)'
            }}
          >
            <div className="absolute left-1/2 bottom-1/2 w-2 h-24 bg-red-500 origin-bottom transform -translate-x-1/2 rounded-t-full shadow-lg">
              <div className="absolute -top-2 -left-2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-red-500"></div>
            </div>
          </div>
          
          <div className="absolute w-6 h-6 bg-yellow-400 rounded-full shadow-inner z-30 border-2 border-white"></div>
        </div>

        {!rouletteResult && rouletteAngle === 0 && (
          <button 
            onClick={startRoulette}
            className="mt-16 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-10 rounded-full text-xl shadow-[0_0_15px_rgba(220,38,38,0.6)] active:scale-95 transition-transform"
          >
            回す！
          </button>
        )}
      </div>
    );
  }

  if (!players.length) return null;

  return (
    <div className="flex flex-col h-screen bg-green-900 text-white font-sans overflow-hidden">
      
      <div className="flex overflow-x-auto justify-start sm:justify-center items-center p-2 bg-black bg-opacity-30 flex-shrink-0 min-h-[100px] gap-3" style={{ scrollbarWidth: 'none' }}>
        {players.slice(1).map((cpu, idx) => (
          <div key={cpu.id} className={`flex flex-col items-center flex-shrink-0 ${currentPlayerIndex === cpu.index ? 'ring-2 ring-yellow-400 rounded p-1 bg-yellow-400 bg-opacity-20' : 'p-1'}`}>
            <span className="text-xs font-bold mb-1 truncate w-16 text-center">{cpu.name}</span>
            {cpu.isOut ? (
              <span className="text-xs text-yellow-300 font-bold">上がり</span>
            ) : (
              <div className="relative w-10 h-14">
                <CardRender isFaceDown size="sm" />
                <span className="absolute -bottom-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white z-10">
                  {cpu.hand.length}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        <div className="absolute top-4 w-full flex justify-center text-gray-400 text-sm font-bold opacity-50">
          {direction === 1 ? '⟳ 時計回り' : '⟲ 反時計回り'}
        </div>

        <div className="flex items-center gap-6 my-4">
          <div className="relative">
            <div className="absolute top-1 left-1"><CardRender isFaceDown size="lg" /></div>
            <div className="absolute top-0.5 left-0.5"><CardRender isFaceDown size="lg" /></div>
            <CardRender isFaceDown size="lg" />
          </div>
          <div className="relative">
            {discardPile.slice(-3).map((card, idx, arr) => {
              const rotateDeg = (idx - 1) * 10;
              return (
                <div 
                  key={card.id} 
                  className={`absolute ${idx === arr.length - 1 ? 'relative' : 'top-0 left-0'} transform`} 
                  style={{ zIndex: idx, transform: idx !== arr.length - 1 ? `rotate(${rotateDeg}deg)` : 'none' }}
                >
                  <CardRender card={card} size="lg" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="flex items-center gap-2 bg-black bg-opacity-40 px-3 py-1 rounded-full text-sm">
            <span>現在の色:</span>
            <span className={`w-4 h-4 rounded-full ${getColorClass(currentColor)} border border-white`}></span>
          </div>
          {drawStack > 0 && (
            <div className="text-red-400 font-bold animate-pulse text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full">
              スタック中: +{drawStack} 枚 ({drawStackType})
            </div>
          )}
        </div>

        <div className="w-full max-w-sm h-24 bg-black bg-opacity-50 rounded p-2 overflow-y-auto text-xs text-gray-300">
          {messages.map((msg, i) => (
            <div key={i} className="mb-0.5">{msg}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className={`flex flex-col bg-black bg-opacity-80 p-2 pb-6 transition-colors duration-300 ${currentPlayerIndex === 0 && !gameOver ? 'border-t-4 border-yellow-400' : ''}`}>
        <div className="flex justify-between items-center mb-2 px-2">
          <div className="text-sm font-bold flex items-center gap-2">
            <span>あなた</span>
            {players[0].isOut && <span className="text-yellow-400">上がり</span>}
            <span className="bg-gray-700 px-2 rounded-full">{players[0].hand.length} 枚</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleUserDraw}
              disabled={currentPlayerIndex !== 0 || players[0].isOut || gameOver}
              className={`px-4 py-2 rounded font-bold text-sm ${currentPlayerIndex === 0 && !players[0].isOut ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
            >
              {drawStack > 0 ? `+${drawStack} 引く` : '1枚引く'}
            </button>
            <button 
              onClick={handlePlaySelected}
              disabled={currentPlayerIndex !== 0 || selectedCards.length === 0 || players[0].isOut || gameOver}
              className={`px-6 py-2 rounded font-bold text-sm ${currentPlayerIndex === 0 && selectedCards.length > 0 ? 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-[0_0_10px_rgba(220,38,38,0.8)]' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
            >
              出す ({selectedCards.length})
            </button>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-[-1rem] py-4 px-2 min-h-[140px] items-end" style={{ scrollbarWidth: 'none' }}>
          {players[0].hand.map((card, idx) => {
            const isMyTurn = currentPlayerIndex === 0 && !gameOver && !players[0].isOut;
            const topCard = discardPile[discardPile.length - 1];
            
            let isPlayable = false;
            if (isMyTurn) {
              if (selectedCards.length > 0) {
                const firstSelectedCard = players[0].hand.find(c => c.id === selectedCards[0]);
                isPlayable = card.value === firstSelectedCard?.value;
              } else {
                isPlayable = canPlayCard(card, topCard, currentColor, drawStack, drawStackType);
              }
            }

            const isSelected = selectedCards.includes(card.id);

            return (
              <div key={card.id} className="flex-shrink-0" style={{ marginLeft: idx === 0 ? 0 : '-1.5rem', zIndex: isSelected ? 30 : (isPlayable ? 20 : idx) }}>
                <CardRender 
                  card={card} 
                  isSelected={isSelected}
                  isPlayable={isPlayable}
                  isMyTurn={isMyTurn}
                  onClick={() => handleCardSelect(card)}
                />
              </div>
            );
          })}
          {players[0].hand.length === 0 && (
             <div className="w-full text-center text-gray-500 italic mt-8">手札がありません</div>
          )}
        </div>
      </div>

      {pendingDrawnCard && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm text-center shadow-2xl border border-gray-600">
            <h2 className="text-xl font-bold text-white mb-4">引いたカードが出せます</h2>
            <div className="flex justify-center mb-6">
               <CardRender card={pendingDrawnCard} size="lg" />
            </div>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => {
                  const card = pendingDrawnCard;
                  setPendingDrawnCard(null);
                  if (card.color === 'black') {
                    setPendingPlay({ playerIndex: 0, cards: [card] });
                    setShowColorPicker(true);
                  } else {
                    executePlay(0, [card], null);
                  }
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded"
              >
                出す
              </button>
              <button 
                onClick={() => {
                  setPendingDrawnCard(null);
                  const nextIndex = getNextPlayerIndex(0, direction, 0, players);
                  advanceTurn(nextIndex);
                }}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded"
              >
                キープ
              </button>
            </div>
          </div>
        </div>
      )}

      {showColorPicker && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center shadow-2xl transform transition-all scale-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6">色を選択してください</h2>
            <div className="grid grid-cols-2 gap-4">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-full aspect-square rounded-lg shadow-md active:scale-95 transition-transform ${getColorClass(color)} border-4 border-transparent hover:border-gray-300`}
                ></button>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4">
          <h1 className="text-4xl font-bold text-yellow-400 mb-8 animate-bounce">ゲーム終了！</h1>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-xs mb-8 border border-gray-700">
            <h2 className="text-xl text-center border-b border-gray-600 pb-2 mb-4">最終順位</h2>
            {ranks.map((name, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 text-lg">
                <span className={`${idx === 0 ? 'text-yellow-400 font-bold' : 'text-white'}`}>{idx + 1}位</span>
                <span className="font-bold">{name}</span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setGameState('setup')}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-[0_0_15px_rgba(22,163,74,0.6)] active:scale-95 transition-transform"
          >
            新しくゲームを始める
          </button>
        </div>
      )}

    </div>
  );
}
