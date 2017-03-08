
function infoPanel(id, title, header, headerComments, toolbar) {

  var currentObj = this;
  this.id = id;
  this.header = header;
  this.headerComments = headerComments;
  this.showAll = false;
  this.defaultTags = [ "TSTART", "TSTOP", "TIMEUNIT", "TIMESYS", "DURATION", "FRMTIME",
                       "DATE-OBS", "DATE-END", "OBJECT", "OBSERVER", "TELESCOP", "INSTRUME",
                       "OBS_ID", "OBS_MODE", "EXP_ID"];

  this.$html = $('<div class="infoPanel ' + this.id + '">' +
                 '<button class="btn btnShowAll">Show All</button>' +
                 '<button class="btn btnHide">Hide</button>' +
                 '<h3>' + title + '</h3>' +
                 '<table class="properties"></table>' +
               '</div>');

  this.container = this.$html.find(".properties");
  this.btnShowAll = this.$html.find(".btnShowAll");
  this.btnShowAll.click(function(event){
    currentObj.showAll = !currentObj.showAll;
    currentObj.redraw();
  });

  this.btnShow = $('<button class="btn btnShow' + this.id + '">Show</button>');
  this.btnShow.hide();
  toolbar.append(this.btnShow);

  this.btnHide = this.$html.find(".btnHide");

  this.btnShow.click(function(event){
     currentObj.$html.show();
     currentObj.btnShow.hide();
  });

  this.btnHide.click(function(event){
     currentObj.$html.hide();
     currentObj.btnShow.show();
  });

  this.getPropertyHtml = function(tag, value, comment) {
    return $('<tr class="property ' + tag + '">' +
              '<td class="tag">' + tag + '</td>' +
              '<td class="value">' + value + '</td>' +
              '<td class="comment">' + comment + '</td>' +
            '</tr>');
  }

  this.redraw = function() {
    this.container.html("");

    var keys = [];
    for (key in this.header) {
      if (this.defaultTags.includes(key) || this.showAll) {
        keys.push(key);
      }
    }

    if (keys.length > 0) {
      keys.sort ();

      for (i in keys){
        var tag = keys[i];
        this.container.append(this.getPropertyHtml(tag, this.header[tag], this.headerComments[tag]));
      }
    } else {
      this.container.append('<tr><td>No default header tags found!</td></tr>');
    }

  }

  this.redraw();

  log ("new infoPanel id: " + this.id);

  return this;
}
