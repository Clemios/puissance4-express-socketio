const express = require('express');
const routes = require('./routes/index');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const port = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

routes(app);

server.listen(port, () => console.log('listening on port ' + port));

var winner_count = {};

var LINES = 6;

var COLS = 7;

var MATRICE = [];

var players = {
  J: {
    id: undefined,
    name: undefined,
    status: undefined,
  },
  R: {
    id: undefined,
    name: undefined,
    status: undefined,
  },
  OTHERS: {},
};

var turn_to = "J";

var winner = false;

var isFilled = function (line, column) {
  var node;
  node = MATRICE[line][column];
  return node === 0 || (node === 'J' || node === 'R');
};

var lineCombinations = function (column) {
  var c, combination, combinations, _i, _len;
  combinations = [
    [0, 1, 2, 3],
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6]
  ];
  c = [];
  for (_i = 0, _len = combinations.length; _i < _len; _i++) {
    combination = combinations[_i];
    if (combination.indexOf(column) > -1) c.push(combination);
  }
  return c;
};

var isLineWinningMove = function (line, column, number) {
  var combination, num, winned, _i, _j, _len, _len2, _ref;
  _ref = lineCombinations(column);
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    combination = _ref[_i];
    winned = true;
    for (_j = 0, _len2 = combination.length; _j < _len2; _j++) {
      num = combination[_j];
      if (MATRICE[line][num] !== number) winned = false;
    }
    if (winned) return winned;
  }
  return false;
};

var columnCombinations = function (line) {
  var c, combination, combinations, _i, _len;
  combinations = [
    [0, 1, 2, 3],
    [1, 2, 3, 4],
    [2, 3, 4, 5]
  ];
  c = [];
  for (_i = 0, _len = combinations.length; _i < _len; _i++) {
    combination = combinations[_i];
    if (combination.indexOf(line) > -1) c.push(combination);
  }
  return c;
};

var isColumnWinningMove = function (line, column, number) {
  var combination, num, winned, _i, _j, _len, _len2, _ref;
  _ref = columnCombinations(line);
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    combination = _ref[_i];
    winned = true;
    for (_j = 0, _len2 = combination.length; _j < _len2; _j++) {
      num = combination[_j];
      if (MATRICE[num][column] !== number) winned = false;
    }
    if (winned) return winned;
  }
  return false;
};

var isDiagonalWinningMove = function (line, column, number) {
  return false;
};

var isWinningMove = function (line, column, number) {
  console.log('IS WINNING ??');
  console.log(line, column, number);
  console.log(isColumnWinningMove(line, column, number));
  console.log(isLineWinningMove(line, column, number));
  return isColumnWinningMove(line, column, number) || isLineWinningMove(line, column, number) || isDiagonalWinningMove(line, column, number);
};

function onConnection(socket) {
  socket.on("connectPlayer", function (data) {
      socket.player_name = data.name;
      newPlayer = {name:data.name, status: "connected"}
      players.OTHERS[socket.id] = newPlayer;
      //players.OTHERS.push(newPlayer);
      console.log("PLAYERS", players);
  });

  socket.on('game:register', function (data) {
    // Enregistrement du premier joueur

    if (players.J.id == undefined) {
      // Initialisation du joueur Jaune
      socket.player = "J";
      socket.player_name = data.name;
      players.J.id = socket.id;
      players.J.name = players.OTHERS[socket.id].name;
      players.OTHERS[socket.id].status = "playing"
      players.J.status = "registred"
    } else if (players.R.id == undefined) {
      // Initialisation du joueur Rouge
      socket.player = "R";
      socket.player_name = data.name;
      players.R.id = socket.id;
      players.R.name = players.OTHERS[socket.id].name;
      players.OTHERS[socket.id].status = "playing"
      players.R.status = "registred"

    } else if (players.R.id && players.J.id){
      console.log('GAME IS RUNNING PLEASE WAIT');
    }
    var nextPlayer = players.J.id == data.id ? players.R : players.J;
    var nextPlayerPosition = players.J.id == data.id ? 'R' : 'J';
    var currentPlayer = players.J.id == data.id ? players.J : players.R;
    var currentPlayerPosition = players.J.id == data.id ? 'J' : 'R';
    currentPlayer.status = "registered";
    socket.emit('game:registered', {currentPlayerPosition, currentPlayerName: currentPlayer.name});
    // Tentative de gestion des parties pour forcer la présence de 2 joueurs
    if (nextPlayer.status !== "registered") {
      // Dans l'attente du second joueur
      io.to(nextPlayer.id).emit("game:pleaseRegister", {
        player: nextPlayerPosition
      });
    } else {
      var playersObject = [players.J, players.R];
      // On définit de manière random qui jouera en premier
      var firstPlayer = playersObject[Math.floor(Math.random() * playersObject.length)];
      var firstPosition = firstPlayer.id == players.J.id ? 'J' : 'R';
      var secondPlayer = firstPlayer.id == players.J.id ? players.R : players.J;
      var secondPosition = firstPlayer.id == players.J.id ? 'R' : 'J';
      io.sockets.emit("game:ready");
      // Initialisation de la matrice en fonction des paramètres
      for (num = 0; 0 <= LINES ? num < LINES : num > LINES; 0 <= LINES ? num++ : num--) {
        MATRICE[num] = new Array(COLS);
      }
      data = {
        matrice: MATRICE,
        player: firstPosition
      };
      io.to(firstPlayer.id).emit("game:firstTurn", data);
      io.to(secondPlayer.id).emit("game:secondTurn", data);
    }
  });

  socket.on('game:play', function (data) {
    var nextId = players.J.id == data.socketId ? players.R.id : players.J.id;
    var currentId = players.J.id == data.socketId ? players.J.id : players.R.id;
    var nextPlayer = players.J.id == data.socketId ? 'R' : 'J';
    var currentPlayer = players.J.id == data.socketId ? 'J' : 'R';

    for (num = _ref = LINES - 1; _ref <= 0 ? num <= 0 : num >= 0; _ref <= 0 ? num++ : num--) {
      // Detection des jetons dejas joués
      if (!isFilled(num, data.colPlayedAt)) {
        MATRICE[num][data.colPlayedAt] = currentPlayer;
        data = {
          line: num,
          column: data.colPlayedAt,
          player: currentPlayer,
          nextPlayer: nextPlayer
        };
        console.log(MATRICE);
        console.log("data.colPlayedAt", data)
        socket.emit("game:played", data);
        io.to(nextId).emit("game:newturn", data);
        // Detection du gagnant
        if (isWinningMove(num, data.column, data.player, data.nextPlayer)) {
          console.log('ON A UN GAGNANT !!');
          io.to(currentId).emit("game:win");
          io.to(nextId).emit("game:loose");
          // stop();
        }
        return;
      }
    }
    return socket.emit("game:box_not_available");
    console.log("NOT AVAILABLE")
    console.log(MATRICE);
  });

  socket.on('disconnect', function () {
    io.sockets.emit('disconnect');
  });
}


io.on('connection', onConnection);