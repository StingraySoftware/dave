//Actions history manager
function HistoryManager(applyActionFn){

  this.applyActionFn = applyActionFn
  this.actionsHistory = [];
  this.prevAction = null;

  this.addToHistory = function (action){
      //Adds a action to actionsHistory, uses { obj } for cloning data (new obj reference)
      if (this.prevAction != null) {
        this.actionsHistory.push( $.extend(true, {}, this.prevAction) );
      }

      //Stores a action on prevAction tmp var, uses $.extend for cloning data (new obj reference)
      this.prevAction = $.extend(true, [], action);
  }

  this.undoHistory = function () {
    if (this.actionsHistory.length > 0) {
      this.applyAction(this.actionsHistory.pop());
    }
  }

  this.resetHistory = function () {
    if (this.actionsHistory.length > 0) {
      var action = this.actionsHistory[0];
      this.actionsHistory = []; // Clears action history keeping default state
      this.applyAction(action);
      this.prevAction = null;
      this.addToHistory(action);
    } else {
      this.applyAction(this.prevAction);
    }
  }

  this.applyAction = function(action){
    this.applyActionFn(action);
    this.prevAction = $.extend(true, [], action);
  }

  return this;
}
