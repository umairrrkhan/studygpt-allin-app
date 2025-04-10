import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, doc, updateDoc } from 'firebase/firestore'; // Add updateDoc import
import { auth, db } from '../firebase';

const Starfield = () => {
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const stars = useRef(Array.from({ length: 100 }, () => ({
    left: Math.random() * screenWidth,
    top: Math.random() * screenHeight,
    size: Math.random() * 3 + 1,
  }))).current;

  return (
    <>
      {stars.map((star, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            backgroundColor: '#fff',
            borderRadius: star.size / 2,
            opacity: 0.8,
          }}
        />
      ))}
    </>
  );
};

export default function BurnoutRelief({ navigation }) {
  const [shots, setShots] = useState([]);
  const [gameActive, setGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [enemies, setEnemies] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [lastShotAngle, setLastShotAngle] = useState(0);
  const [baseSpeed, setBaseSpeed] = useState(1);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const explosions = useRef([]);
  const hitFlash = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const playerBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadHighScore();
  }, []);

  useEffect(() => {
    if (score > 0) {
      Animated.sequence([
        Animated.timing(scoreScale, {
          toValue: 1.5,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scoreScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [score]);

  const loadHighScore = async () => {
    try {
      // Always check local storage first for instant load
      const cachedScore = await AsyncStorage.getItem('@highScore');
      if (cachedScore) {
        setHighScore(parseInt(cachedScore));
      }

      // Then check Firebase in background
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const firebaseScore = userDoc.data().highScore || 0;
        const localScore = parseInt(cachedScore || '0');
        
        // Use highest score between local and Firebase
        const finalScore = Math.max(firebaseScore, localScore);
        setHighScore(finalScore);
        await AsyncStorage.setItem('@highScore', String(finalScore));
      }
    } catch (error) {
      console.error('Error loading high score:', error);
    }
  };

  const saveHighScore = async (newScore) => {
    try {
      const user = auth.currentUser;
      if (!user || newScore <= highScore) return;

      // Update local state and storage immediately
      setHighScore(newScore);
      await AsyncStorage.setItem('@highScore', String(newScore));

      // Update Firebase in background
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, {
        highScore: newScore,
        lastPlayed: new Date()
      }).catch(error => {
        console.error('Firebase update error:', error);
        // Firebase update failed but local score is saved
      });

    } catch (error) {
      console.error('Error saving high score:', error);
    }
  };

  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setGameOver(false);
    setEnemies([]);
    setShots([]);
    setBaseSpeed(1);
    animatePlayerBounce();
  };

  const animatePlayerBounce = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(playerBounce, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(playerBounce, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const createExplosion = (x, y) => {
    const explosion = new Animated.Value(0);
    explosions.current.push({ x, y, animation: explosion });

    Animated.sequence([
      Animated.timing(explosion, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(explosion, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      explosions.current = explosions.current.filter(e => e.animation !== explosion);
    });

    Animated.sequence([
      Animated.timing(hitFlash, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(hitFlash, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleShoot = (targetX, targetY) => {
    if (!gameActive || gameOver) return;

    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    setLastShotAngle(angle);

    const shotSpeed = 15;
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    const newShot = {
      id: Date.now(),
      x: centerX + normalizedDx * 25,
      y: centerY + normalizedDy * 25,
      vx: normalizedDx * shotSpeed,
      vy: normalizedDy * shotSpeed,
    };

    setShots(prev => [...prev, newShot]);
  };

  const renderPlayer = () => (
    <Animated.View
      style={[styles.player, { transform: [{ scale: playerBounce }] }]}
      pointerEvents="none"
    >
      <View style={styles.playerBody}>
        <View style={styles.playerGlow} />
      </View>
      <View
        style={[
          styles.playerIndicator,
          {
            transform: [
              { translateX: Math.cos(lastShotAngle) * 25 },
              { translateY: Math.sin(lastShotAngle) * 25 },
            ],
          },
        ]}
      />
    </Animated.View>
  );

  const renderEnemy = (enemy) => (
    <Animated.View
      key={enemy.id}
      style={[
        styles.enemy,
        {
          left: enemy.x - enemy.size / 2,
          top: enemy.y - enemy.size / 2,
          width: enemy.size,
          height: enemy.size,
          transform: [{ rotate: `${enemy.rotation}deg` }],
        },
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.enemyInner,
          enemy.shape === 0 && styles.enemyTriangle,
          enemy.shape === 1 && styles.enemySquare,
          enemy.shape === 2 && styles.enemyPentagon,
        ]}
      >
        <View style={styles.enemyCore} />
      </View>
    </Animated.View>
  );

  useEffect(() => {
    let spawnInterval;
    if (gameActive && !gameOver) {
      const spawnEnemies = () => {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        switch (edge) {
          case 0: x = Math.random() * screenWidth; y = -50; break;
          case 1: x = screenWidth + 50; y = Math.random() * screenHeight; break;
          case 2: x = Math.random() * screenWidth; y = screenHeight + 50; break;
          case 3: x = -50; y = Math.random() * screenHeight; break;
        }

        const enemy = {
          id: Date.now(),
          x,
          y,
          targetX: screenWidth / 2,
          targetY: screenHeight / 2,
          size: 45,
          speed: baseSpeed,
          shape: Math.floor(Math.random() * 3),
          rotation: Math.random() * 360,
        };

        setEnemies(prev => [...prev, enemy]);
      };

      const spawnRate = Math.max(1000 - score * 30, 300);
      spawnInterval = setInterval(spawnEnemies, spawnRate);
    }
    return () => clearInterval(spawnInterval);
  }, [gameActive, gameOver, score, baseSpeed]);

  useEffect(() => {
    if (score > 0 && score % 10 === 0) {
      setBaseSpeed(prev => Math.min(prev + 0.1, 3));
    }
  }, [score]);

  useEffect(() => {
    let updateLoop;
    if (gameActive && !gameOver) {
      updateLoop = setInterval(() => {
        setShots(prevShots => {
          const updatedShots = prevShots.map(shot => ({
            ...shot,
            x: shot.x + shot.vx,
            y: shot.y + shot.vy,
          }));

          return updatedShots.filter(shot => {
            const offScreen =
              shot.x < -20 || shot.x > screenWidth + 20 || shot.y < -20 || shot.y > screenHeight + 20;
            if (offScreen) return false;

            let hit = false;
            setEnemies(prevEnemies => {
              const remainingEnemies = prevEnemies.filter(enemy => {
                const dx = shot.x - enemy.x;
                const dy = shot.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < enemy.size / 2 + 10) {
                  setScore(prev => prev + 1);
                  createExplosion(enemy.x, enemy.y);
                  hit = true;
                  return false;
                }
                return true;
              });
              return remainingEnemies;
            });
            return !hit;
          });
        });

        setEnemies(prev => {
          return prev.map(enemy => {
            const dx = screenWidth / 2 - enemy.x;
            const dy = screenHeight / 2 - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 35) {
              setGameOver(true);
              saveHighScore(score);
              return enemy;
            }

            const speed = enemy.speed * (1 + Math.min(score / 50, 1));
            return {
              ...enemy,
              x: enemy.x + (dx / distance) * speed,
              y: enemy.y + (dy / distance) * speed,
              rotation: (enemy.rotation || 0) + 3,
            };
          });
        });
      }, 16);
    }
    return () => clearInterval(updateLoop);
  }, [gameActive, gameOver, score, screenWidth, screenHeight]);

  const renderShot = (shot) => (
    <View
      key={shot.id}
      style={[
        styles.shot,
        {
          left: shot.x - 6,
          top: shot.y - 6,
        },
      ]}
      pointerEvents="none"
    />
  );

  return (
    <View style={styles.container}>
      {!gameActive ? (
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>BURNOUT BLASTER</Text>
          <Text style={styles.instructions}>Tap to BLAST enemies!</Text>
          <View style={styles.menuHighScoreContainer}>
            <Text style={styles.menuHighScore}>High Score: {highScore}</Text>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={startGame} activeOpacity={0.7}>
            <Text style={styles.startButtonText}>PLAY NOW</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.gameArea}
          activeOpacity={1}
          onPress={e => {
            const { locationX, locationY } = e.nativeEvent;
            handleShoot(locationX, locationY);
          }}
        >
          <Starfield />
          {renderPlayer()}
          {shots.map(renderShot)}
          {enemies.map(renderEnemy)}
          {explosions.current.map((explosion, index) => (
            <Animated.View
              key={index}
              style={[
                styles.explosion,
                {
                  left: explosion.x - 40,
                  top: explosion.y - 40,
                  opacity: explosion.animation,
                  transform: [
                    {
                      scale: explosion.animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 3],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            />
          ))}
          <Animated.View
            style={{
              position: 'absolute',
              top: 40,
              left: 20,
              padding: 8,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 5,
              borderWidth: 2,
              borderColor: '#fff',
              transform: [{ scale: scoreScale }],
            }}
            pointerEvents="none"
          >
            <Text style={styles.score}>Score: {score}</Text>
          </Animated.View>
          {gameOver && (
            <View style={styles.gameOverContainer}>
              <Text style={styles.gameOverText}>GAME OVER!</Text>
              <Text style={styles.finalScore}>Score: {score}</Text>
              <Text style={styles.highScore}>High Score: {highScore}</Text>
              <TouchableOpacity style={styles.restartButton} onPress={startGame} activeOpacity={0.7}>
                <Text style={styles.restartButtonText}>REPLAY</Text>
              </TouchableOpacity>
            </View>
          )}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#fff',
              opacity: hitFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            }}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#1c2526',
  },
  player: {
    position: 'absolute',
    left: Dimensions.get('window').width / 2 - 25,
    top: Dimensions.get('window').height / 2 - 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerBody: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00ccff',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#00ccff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  playerGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 25,
    backgroundColor: 'transparent',
    shadowColor: '#00ccff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  playerIndicator: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#ff66cc',
    borderWidth: 2,
    borderColor: '#fff',
  },
  shot: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#ffcc00',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#ffcc00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  enemy: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enemyInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  enemyCore: {
    width: '60%',
    height: '60%',
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  enemyTriangle: {
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 22,
    borderRightWidth: 22,
    borderBottomWidth: 45,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ff3366',
  },
  enemySquare: {
    backgroundColor: '#9933ff',
    borderRadius: 10,
  },
  enemyPentagon: {
    backgroundColor: '#ff9933',
    borderRadius: 12,
    transform: [{ rotate: '36deg' }],
  },
  explosion: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff00ff',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  score: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    textShadowColor: '#00ccff',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  menuTitle: {
    color: '#ffcc00',
    fontSize: 60,
    fontFamily: 'Impact',
    textShadowColor: '#ff3366',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 8,
    marginBottom: 20,
  },
  instructions: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Arial',
    textShadowColor: '#9933ff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 30,
  },
  menuHighScoreContainer: {
    position: 'absolute',
    top: 40,
    right: 40,
  },
  menuHighScore: {
    color: '#00ccff',
    fontSize: 28,
    fontFamily: 'Courier New',
    textShadowColor: '#fff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  startButton: {
    backgroundColor: '#ff3366',
    paddingHorizontal: 50,
    paddingVertical: 20,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#ff3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  gameOverContainer: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 10,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#ffcc00',
    shadowColor: '#ffcc00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  gameOverText: {
    color: '#ff3366',
    fontSize: 56,
    fontFamily: 'Impact',
    textShadowColor: '#fff',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 6,
    marginBottom: 15,
  },
  finalScore: {
    color: '#fff',
    fontSize: 32,
    fontFamily: 'Courier New',
    marginBottom: 15,
  },
  highScore: {
    color: '#00ccff',
    fontSize: 28,
    fontFamily: 'Courier New',
    marginBottom: 25,
  },
  restartButton: {
    backgroundColor: '#9933ff',
    paddingHorizontal: 40,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#9933ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  restartButtonText: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});