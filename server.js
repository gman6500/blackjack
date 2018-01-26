var express=require('express')
var app=express();
var server=require('http').createServer(app);
var io=require('socket.io')(server);

app.use(express.static(__dirname+"/node_modules"));

app.get('/',function(req,res,next){
    res.sendFile(__dirname+'/index.html')
})

var players=[];
var deck=[];
var __cards=['2','3','4','5','6','8','9','10','j','q','k','a'];
var __suit=['clubs','hearts','spades','diamonds']
var __currentId=0;
var isGameGoing=false;
var countDownGoing=false;
var intervalCount=3;
var turnCountDown;
var whoseTurn=0;
var clients=[];
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function Card(mvalue,msuit){
    this.value=mvalue;
    this.suit=msuit;
}
function generateDeck(){
    console.log("generateDeck")
    deck=[];
    var currentCard=0;
    for(i=0;i<__cards.length;i++){
        for(e=0;e<4;e++){
            var temp=new Card(__cards[i],__suit[e])
            deck.push(temp)
        }
    }
    shuffle(deck);
    for(i=0;i<deck.length;i++){
        console.log(deck[i].value+" of "+deck[i].suit)
    }
    
}
generateDeck();

function drawCard(){
    return deck.shift();
}





function Player(id,name,myClient){
    this.id=id;
    this.myClient=myClient;
    this.name=name;
    this.cards=[];
    this.busted=false;
    this.totalVal=0;
    this.isInGame=false;
    this.recalculateTotalVal=function(){
        var total=0;
        alert(total)
        for(i=0;i<this.cards.length;i++){
            var temp= parseInt(this.cards[i].value);
            if(isNaN(temp)){
                if(this.cards[i].value=='a'){
                    total+=11;
                    if(total>21){
                        total-=10;
                    }
                }else{
                    total+=10;
                }
            }else{
                total+=temp;
            }
        }
        
        this.totalVal=total;
    }
}




io.on("connection",function(client){
    
    function endGame(){
        io.emit("notTurn");
        generateDeck();
        var winner=players[0];
        for(i=0;i<players.length;i++){
            if(!players[i].busted&&winner.totalVal<players[i].totalVal){
                winner=players[i];
            }
        }
        
        
        for(i=0;i<players.length;i++){
            if(players[i].cards!=[]){
                var sentString;
                if(players[i].busted){
                    sentString=players[i].name+" busted with a total of: "+players[i].totalVal+". Their cards were: ";
                }else{
                    sentString=players[i].name+" got a total of: "+players[i].totalVal+". Their cards were: ";
                }
                for(e=0;e<players[i].cards.length;e++){
                    sentString=sentString+players[i].cards[e].value+" of "+players[i].cards[e].suit+". ";
                }
                client.emit("printMe",sentString)
            }
        }
        
        if(winner.busted){
            io.emit('gameOver',"Nobody")
        }else{
            io.emit('gameOver',winner.name)
        }
        isGameGoing=false;
        
        for(i=0;i<players.length;i++){
            players[i].cards=[];
            players[i].totalVal=0;
            players[i].busted=false;
            players[i].isInGame=true;
        }
        //This is for starting the next game
        
        
        for(i=0;i<players.length;i++){
            players[i].cards.push(drawCard());
            players[i].cards.push(drawCard());
        }
        
        var stringAllPlayers=JSON.stringify(players);
        
        
        io.emit('resetNotification',"The next game will begin in 10 seconds")
        setTimeout(function(){
            io.emit('reset');
            io.emit("startGame",stringAllPlayers);
            io.emit("notTurn",players[0].name)
            client.to(players[0].myClient).emit("yourTurn")
        },10000)
    }
    
    clients.push(client);
    var myPlayer;
    console.log("Client Connected");
    client.on('join',function(data){
        console.log(data+" has joined")
        myPlayer=new Player(__currentId,data,client.id);
        client.emit('setId',__currentId)
        __currentId++;
        players.push(myPlayer)
        if(players.length>=2&&!isGameGoing){
            if(!countDownGoing){
                countDownGoing=true;
                turnCountDown=setInterval(function(){
                    io.emit('countDown',intervalCount);
                    intervalCount--;
                    console.log(intervalCount)
                    if(intervalCount<0){
                        clearInterval(turnCountDown);
                        
                        for(i=0;i<players.length;i++){
                            players[i].cards.push(drawCard());
                            players[i].cards.push(drawCard());
                            players[i].isInGame=true;
                        }
                        var temp=JSON.stringify(players);
                        io.emit("startGame",temp);
                        
                        io.emit("notTurn",players[0].name);
                        client.to(players[0].myClient).emit('yourTurn');
                        
                    }
                },1000)
            }else{
                intervalCount=30;
            }
        }
    })

    client.on('hitme',function(data){
        var temp= drawCard();
        temp.name=myPlayer.name;
        client.emit('newCard',temp)
        client.broadcast.emit('otherPlayerHit',temp)
    })
    client.on('stay',function(data){
        var stayingPlayer=JSON.parse(data);
        for(i=0;i<players.length;i++){
            if(players[i].id==stayingPlayer.id){
                players[i]=stayingPlayer;
            }
        }
        whoseTurn++;
        if(whoseTurn>=players.length||!players[whoseTurn].isInGame){
            whoseTurn=0;
            endGame();
            
        }else{
            
            io.emit("notTurn",players[whoseTurn].name);
            client.to(players[whoseTurn].myClient).emit('yourTurn');
        }
    })
    client.on('busted',function(data){
        var bustedPlayer=JSON.parse(data);
        for(i=0;i<players.length;i++){
            if(bustedPlayer.id==players[i].id){
                players[i].busted=true;
            }
        }
        client.broadcast.emit('playerBusted',data);
        client.emit("notTurn")
        whoseTurn++;
        
        if(whoseTurn>=players.length||!players[whoseTurn].isInGame){
            whoseTurn=0;
            endGame();
        }else{
        io.emit("notTurn",players[whoseTurn].name);
        client.to(players[whoseTurn].myClient).emit('yourTurn');
        }
    })
    client.on('disconnect',function(){
        if(typeof myPlayer.name==null){
            
        }else{
        console.log(myPlayer.name+" has left the game");
        for(i=0;i<players.length;i++){
            if(players[i].id==myPlayer.id){
                players.splice(i,1);
            }
        }
        for(i=0;i<clients.length;i++){
            if(client.id==clients[i].id){
                clients.splice(i,1);
                console.log("removed client")
            }
        }
        
        client.broadcast.emit('playerleft',JSON.stringify(myPlayer));
        }
    })
    
})




server.listen(4200);