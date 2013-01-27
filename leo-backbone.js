//    __                                        _            ___               _     _                               _      
//   / /    ___   ___   _ __    __ _  _ __   __| |  ___     / __\  __ _   ___ | | __| |__    ___   _ __    ___      (_) ___ 
//  / /    / _ \ / _ \ | '_ \  / _` || '__| / _` | / _ \   /__\// / _` | / __|| |/ /| '_ \  / _ \ | '_ \  / _ \     | |/ __|
// / /___ |  __/| (_) || | | || (_| || |   | (_| || (_) | / \/  \| (_| || (__ |   < | |_) || (_) || | | ||  __/ _   | |\__ \
// \____/  \___| \___/ |_| |_| \__,_||_|    \__,_| \___/  \_____/ \__,_| \___||_|\_\|_.__/  \___/ |_| |_| \___|(_) _/ ||___/
//                                                                                                                |__/      

// ## global namespace
//
var Leo = {}


// ## Leonardo Options
//
Leo.options = (function() {
  return {
    api     : 'http://dev.leonar.do/api',
    agent   : 'demo',
    key     : 'demo'
  };   
})();

// FIXME remove this!
Leo.ignoreArt = function(model) {
  model.ignore();
}

// ## custom backbone.js sync method
//
Leo.sync = function(method, model, options) {  
    
  // send auth headers
  var new_options =  _.extend({
    beforeSend: function(xhr) {
      var cred = $.base64.encode(Leo.options.key + ':' + Leo.options.agent);
      xhr.setRequestHeader("Authorization", "Basic " + cred);
    }
  }, options);
  
  return Backbone.sync(method, model, new_options);  
}

Leo.util = {
  
  tasteString: function(taste) {
    
    var verb = taste.get('verb');
    console.log('tasteString', taste);
    switch (verb) {
      case 0:
      
        var thumb = taste.get('thumb');
        return {desc: 'Similar to', thumb: thumb };
        break;
      case 2:
        return {desc: 'With tag: ' + taste.get('tagtext')};
        break;
      case 4:
        return {desc: 'By Artist: ' + taste.get('artist_name')};
        break;
      default:
        return {desc: 'Other...'};
    }
    
    //console.log('tasteString', taste);
    //return 'taste: foo';
    
  },  
};

// ## Sync Model, reused throughout
//
Leo.SyncModel = Backbone.Model.extend({    
  sync: Leo.sync    
});

// ## Models
//
Leo.Models = (function() {  
  
  // ### Art Model
  //
  var ArtModel = Leo.SyncModel.extend({
    
    url : function() {
      return Leo.options.api + '/art/' + this.id;
    },
    
    // add to cart
    //
    putIntoCart : function() {
      var cartCollection = new Leo.Collections.Cart();
      cartCollection.create(new Leo.SyncModel({lid: this.id}));      
    },
    
    // mark this art as 'seen'
    //
    markSeen : function() {      
      var seenCollection = new Leo.Collections.SeenArt();
      seenCollection.create(new Leo.SyncModel({lid: this.id}));      
    },
    
    // ignore this art work, it was 'skipped'
    //
    ignore: function() {
      
      var taste = new Leo.Models.Taste({
        ignore : 'lid',
        lid    : this.id
      });  
      
      taste.save(null, {
        success: function() {
          console.log("saving IGNORE: ", this);         
        },
        error: function() {
          alert('error saving taste');
        }
      });  
    },
  });
  
  // ### Taste Model
  //
  var TasteModel = Leo.SyncModel.extend({
    
    url: function() {
      return Leo.options.api + '/taste';
    },
    
  });
  
  // ### Taste Collection Model
  //
  var TasteCollectionModel = Leo.SyncModel.extend({
    
    id: true,
    
    url: function() {
      return Leo.options.api + '/taste';
    },
    
  });
  
  // ## Artist Model
  //
  var ArtistModel = Leo.SyncModel.extend({
    
    url : function() {
      return Leo.options.api + '/artists/' + this.id;
    },    
   
  });
  
  // ### Group Collection Model
  //
  var CartCollectionModel = Leo.SyncModel.extend({
    
    id: true,
    
    url: function() {
      return Leo.options.api + '/cart';
    },
    
  });

  // interface
  //
  return {    
    Art                        : ArtModel,
    Taste                      : TasteModel,
    TasteCollection            : TasteCollectionModel,
    Artist                     : ArtistModel,
    CartCollection             : CartCollectionModel
  };
  
})();


// ## Collections
//
Leo.Collections = (function() {  
  
  // ## Taste Collection
  //
  var TasteCollection = Backbone.Collection.extend({

    initialize: function(models, options) {
      this.options = options || {};
      _.defaults(this.options, { label: 'default' });
    },
    
    url : function() { return Leo.options.api + '/taste/' + this.options.label; },
    
    model: Leo.Models.Taste,
    
    // ###  Retrieve an instance of this collection as a model
    //
    asModel: function() {      
      return new Leo.Models.TasteCollection();
    },
    
    sync:  function(method, model, options)  {    
      options['data'] = { count: 50 };
      return Leo.sync(method, model, options);
    },
    
    parse: function(response) {
      
      response = _.map(response, function(taste) {      
        switch (taste.verb) {
        
            case 2: /* tag like */
              return { tag: taste.context, karma: taste.karma };
            case 4: /* artist like */
              return { artist: taste.artist_name, karma: taste.karma };
            default:
              return { tag: 'unknown' };
              
        }
      });      
      
      return response;
    }
  });

  // ### Recommendations By Single Taste
  //
  var RecommendationByTaste = Backbone.Collection.extend({
    
    model: Leo.Models.Taste,
    
    url : function() { return Leo.options.api + '/suggest/taste/' + this.options.tasteid; },

    sync:  Leo.sync,
    
    initialize: function(models, options) {
      this.options = options;
    },
    
  });
  
  // ### Recommendation Tastes
  //
  var RecommendationTastes = Backbone.Collection.extend({
    
    model: Leo.Models.Taste,
    
    url : function() { return Leo.options.api + '/suggest/tastes'; },

    sync:  function(method, model, options)  {   
      
      // merge
      _.extend(options['data'], this.options);      
      console.log('options', options);
      
      return Leo.sync(method, model, options);
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    },
    
  });

  // ### Recommendation Tastes
  //
  var RecommendationTopTastes = Backbone.Collection.extend({
    
    model: Leo.Models.Taste,
    
    url : function() { return Leo.options.api + '/suggest/tastes/top'; },

    sync: function(method, model, options)  { 
      
      // set data to send
      options['data'] = {};
      
      // merge
      _.extend(options['data'], _.pick(this.options, 'global'));
      
      return Leo.sync(method, model, options);
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    },
    
  });
  
  // ### Cart Recommendation Collection
  //
  var CartRecommendations = Backbone.Collection.extend({
    
    model: Leo.Models.Art,
    
    options: {},

    url : function() { return Leo.options.api + '/suggest/cart'; },

    sync:  function(method, model, options)  {   
      
      // empty rest data
      var restData = {};
      
      // max count
      restData.count =  50;
      
      // set data to send
      options['data'] = restData;
      
      // merge
      _.extend(options['data'], this.options);
      
      return Leo.sync(method, model, options);
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    },
    
  });
  
  // ### Recommendation Collection
  //
  var Recommendations = Backbone.Collection.extend({
    
    model: Leo.Models.Art,
    
    options: {},

    url : function() { return Leo.options.api + '/suggest'; },

    sync:  function(method, model, options)  {   
      
      // empty rest data
      var restData = {};
      
      // max count
      restData.count =  50;
      
      // set data to send
      options['data'] = restData;
      
      // merge
      _.extend(options['data'], this.options);      
      console.log('options', options);
      
      return Leo.sync(method, model, options);
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    },
    
  });
  
  
  // ### Streaming Recommendations
  //
  var StreamRecommendations = Recommendations.extend({    
    url : function() { return Leo.options.api + '/stream/suggest'; },    
  });


  // ### Art Collection
  //
  var LeoArtCollection = Backbone.Collection.extend({
    
    model: Leo.Models.Art,

    sync:  function(method, model, options)  {    

      var params = {};
      
      if (this.options.id)
        params.ids = this.options.ids;
      if (this.options.title)
        params.title = this.options.title;    
      if (this.options.artist)
        params.artist = this.options.artist;      
      if (this.options.artistid)
        params.artistid = this.options.artistid; 
      if (this.options.tags)
        params.tags = this.options.tags;
      if (this.options.tag)
        params.tag = this.options.tag;
      if (this.options.count)
        params.count = this.options.count;      
      if (this.options.coll)
        params.coll = this.options.coll;
      if (this.options.random)
        params.random = 1;
      if (this.options.unseen)
        params.unseen = 1;
      if (this.options.artistid)
        params.artistid = this.options.artistid
      if (this.options.maxtaggedcount)
        params.maxtaggedcount = this.options.maxtaggedcount;
      if (this.options.keyword)
        params.q = this.options.keyword;
        
      options['data'] = params;
      return Leo.sync(method, model, options);
    },
    
    url : function() {
      return Leo.options.api + '/art';
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    }
    
  });
  
  
  // ## "Liked" Art
  //
  var LeoArtLikes = LeoArtCollection.extend({  
    url : function() {
      return Leo.options.api + '/art/like';
    },
  }); 
  

  //## Artist Collection
  //
  var LeoArtistCollection = Backbone.Collection.extend({
    
    model: Leo.Models.Artist,

    sync:  function(method, model, options)  {    

      var params = {};
     
      //params.hastags = 1;
      
      if (this.options.artist)
        params.artist = this.options.artist;
        
      options['data'] = params;
      return Leo.sync(method, model, options);
    },
    
    url : function() {
      return Leo.options.api + '/artists';
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    }
    
  });
  
  // ## Shopping Cart Collection
  //
  var LeoCartCollection = Backbone.Collection.extend({

    sync: Leo.sync,
    
    url: function() {
      return Leo.options.api + '/cart';
    },   
  
    // ###  Retrieve an instance of this collection as a model
    //
    asModel: function() {      
      return new Leo.Models.CartCollection(/* TODO: init with group id */);
    },
        
  });
  
  // ## Art that's been marked as 'seen'
  //
  var LeoSeenArtCollection = Backbone.Collection.extend({
    
    sync: Leo.sync,
    
    url: function() {
      return Leo.options.api + '/art/seen';
    }
    
  });

  // ## Feature Stream Collection
  //
  var LeoStreamCollection = Backbone.Collection.extend({
    
    sync: Leo.sync,
    
    url : function() {
     
      return Leo.options.api + '/features/' + this.options.streamid;
    },
    
    initialize: function(models, options) {
      this.options = options || {};
    }
    
  });


  // interface
  return {    
    Tastes                    : TasteCollection,
    Recommendations           : Recommendations,
    RecommendationTastes      : RecommendationTastes,
    RecommendationTopTastes   : RecommendationTopTastes,
    RecommendationByTaste     : RecommendationByTaste,
    StreamRecommendations     : StreamRecommendations,
    Likes                     : LeoArtLikes,
    Art                       : LeoArtCollection,
    Artists                   : LeoArtistCollection,
    Stream                    : LeoStreamCollection,
    SeenArt                   : LeoSeenArtCollection,
    Cart                      : LeoCartCollection,
    CartRecommendations       : CartRecommendations
  };
  
})();

// ## A special view that understands "View Models"
//
// If 'models' is passed via view options,
// models is set on the view.
//
// A special hash can setup property change events:
//
// 
Backbone.ViewModelView = Backbone.View.extend({  
  
  _simpleViewModels: function(keys) {  
    if (_.isObject(keys))
      return keys.toJSON(); // model was passed
    var simple = {}; // do more than one model
    if (this.models) {
      if (!keys)
        keys = _.keys(this.models);      
      var view = this;
      _.each(keys, function(key) {
        simple[key] = view.models[key].toJSON();
      });
    }
    return simple;
  },

  _initViewModels: function() {
    if (this.options.models) {
      this.models = this.options.models;   
      delete this.options.models;
      if (this.modelEvents) {
        var view = this;
        _.each(_.keys(view.modelEvents), function(key) {
          var parts = key.split(' ');
          if (2 <= parts.length) {
            var handler = view.modelEvents[key];
            var event = parts[0];
            var model = parts[1];
            var sel   = (3 == parts.length) ? parts[2] : _.isString(handler) ? handler : null;       
            if (view.models[model]) {
              if (_.isFunction(handler)) 
                view.models[model].on(event, handler, view);                
              if (sel) {
                view.$el.find(sel).data('model', view.models[model]); // attached model as data to DOM el
                var updateHandler = function() {
                  var eventParts = event.split(':');
                  if (2 == eventParts.length) {
                    var prop = eventParts[1];
                    view.$el.find(sel).text(view.models[model].get(prop));
                  }
                }
                updateHandler();  // udpate immediately
                view.models[model].on(event, updateHandler);  // udpate on event
              }
            }
          }
        });
      }
    }
  },
  
  initialize: function() {
    this._initViewModels();
  }
  
});
  
  
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------



// ## ArtInfo Model
//
var LeoArtInfoModel = Backbone.Model.extend({
  
  urlRoot: Leo.options.api + '/info',
  
  // needed to support jsonp
  sync: function(method, model, options) {  
    options.timeout = 10000;  
    options.dataType = "jsonp";  
    return Backbone.sync(method, model, options);  
  },
  
  initialize: function(options) {
  
    this.id = options.lid;
    
  },
  
});

// ## Thumbnail Model
//
var LeoThumbModel = Backbone.Model.extend({
  // empty
});

// ## Art Tag Model
/*
var LeoArtTagModel = Backbone.Model.extend({
  
  url : function() {
    return Leo.options.api + '/art/' + this.id + '/tags';
  },
  
});
*/

// ## Tag Model
//
var LeoTagModel = Backbone.Model.extend({
  
  url : function() {
    return Leo.options.api + '/art/' + this.get('lid') + '/tags';
  },
  
  sync: Leo.sync,
 
});



//## Art Tags Collection
//
var LeoArtTagCollection = Backbone.Collection.extend({
  
  model: LeoTagModel,

  sync: Leo.sync,
  
  url : function() {
    return Leo.options.api + '/art/' + this.lid + '/tags';
  },
  
  initialize: function(models, options) {
    this.lid = options.lid;
  }
  
});

// ## Welcome Collection
//
var LeoWelcomeCollection = Backbone.Collection.extend({
  
  model: LeoThumbModel,

  // needed for jsonp
  sync: function(method, model, options) {  
    options.timeout = 10000;  
    options.dataType = "jsonp";  
    return Backbone.sync(method, model, options);  
  },
  
  url : function() {
    console.log('leo url = ' + Leo.options.api + '/welcome');
    return Leo.options.api + '/art/welcome';
  },
  
});

//
// ### Leonardo Tag Collection
//
var LeoTagCollection = Backbone.Collection.extend({
  
  model: LeoTagModel,

  // needed for jsonp
  sync: function(method, model, options) {  
    options.timeout = 10000;  
    options.dataType = "jsonp";  
    return Backbone.sync(method, model, options);  
  },
  
  url : function() {
    return Leo.options.api + '/tags';
  },
  
  parse: function(data) {
    var tags = _.map(data, function(item) {
      return {'tag': item};
    });
    return tags;
  },
  
});

//
// ### ArtFeedback View
//
var ArtFeedbackView = Backbone.View.extend({

  tagName: 'ul',
  
  render: function() {
   
    var list = $(this.make(this.tagName, {'class': 'inputs-list'}));
    
    var model = this.options.model
    console.log('rendering model: ' , model);
    
    $(this.el).html(list);
    
    //
    // tag options
    //
    if (model.has('tags')) {
      
      model.get('tags').forEach(function(item) {        
        var templateString = $('#template-checkbox').html();
        var htmlTemplate = _.template(templateString); 
        list.append(htmlTemplate({ type: 'tag', value: item, label: 'tag: ' + item }));
      });
    }
    
    //
    // feature options
    //
    if (model.has('features')) {
      
      model.get('features').forEach(function(item) {        
        var templateString = $('#template-checkbox').html();        
        var htmlTemplate = _.template(templateString);         
        list.append(htmlTemplate({ type: 'feature', value: item.id, label: item.label }));        
      });
    }    
    
    var view = this;
  
    $('#feedback input:checkbox').change(function() {
  
      var result = false;
      $('#feedback :checkbox').each(function() {
          if ($(this).is(":checked"))
            result = true;
      });
      
      console.log("result = ", result);
      
      view.trigger('taste:update', result);
    });
  },

  initialize: function() {
  
    // get the associated collection
    var model = this.options.model;
    
    // bind the reset event when the collection is retrieved remotely
    model.bind("change", function(data) {          
      this.render();
    }, this);
  
    // retrieve the model from the server
    model.fetch();
  },
  
  
});

// ## Art Metadata View
//
var ArtMetaView = Backbone.View.extend({
  
  render: function() {
    //console.log(this);
    var html = this.options.template(this.model.toJSON());
    //console.log("html: ", html);
    $(this.el).html(html);
    return this;
  }
  
});

// ## ArtImage View
//
/*
var LeoArtImageView = Backbone.View.extend({
  
  render: function() {
    
    var model     = this.options.model;  
    
    // use template text
    //
    if (this.options.template) {
      var template        = this.options.template;
      var templateText    = $(template).text();
            
      var html = Mustache.render(templateText, model.toJSON());
      $(this.el).append(html);
    }
  }
});
*/

// ### Thumbnail View
//
var LeoArtStreamView = Backbone.View.extend({

  // fade in the images when they are finished loading
  //
  //xxfadeInImages : function(callback) {
  render: function() {
    
    var parent = $(this.el);
    
    // use template text
    //
    if (this.options.template) {
      var template        = this.options.template;
      var templateText    = $(template).text();
    
      this.collection.each(function(model) {
        
        // create new element
        var child = $('<li>');
        
        // create HTML
        var html = Mustache.render(templateText, model.toJSON());
        child.html(html);
        
        // insert elements
        parent.append(child);
        
      });
    }
    
    // show only the first three
    /*
    _.each(coll.first(numWorks), function(work) {
      
      var child = $('<li>');
      
      // create view for model
      var ArtView = artView = new LeoArtImageView({model: work, el: child, template: template, onSelect: onSelect, form: form, jQueryMobileList: jQueryMobileList });
      
      // render the subview
      artView.render();
      
      // insert elements
      el.append(child); //.trigger('create');
      
      // fade-in on load
      el.find('img').load(function() {
        $(this).fadeIn('slow', function() {
          callback(view);
        });
      })
      .each(function() { // IE hack
        if(this.complete) $(this).trigger("load");
      });        
    });
    */
  },

  // fade out the images before showing them
  //
  fadeOutImages : function(callback) {
  
    var el      = this.options.el;
    var view    = this;
    var images  = el ? el.find('LI') : [];
    
    if (0 < images.length) {      
      el.find('img').fadeOut('slow', function() {
        el.html('');
        if (callback)
          callback(view);
      });
    }
    else {
      if (callback)
        callback(view);
    }
  },
  
  // render the welcome images view
  //
  xrender: function() {      
    var el = this.options.el;      
    
    this.trigger("imageFadeOutStart");
    
    this.fadeOutImages(function(view) {          
      view.fadeInImages(function() {
        view.trigger("imageVisible");
      });          
    });
  },
  
  clear: function() {
    this.fadeOutImages();
  },

  // init the collection view
  //
  initialize: function() {
 
    // get the associated collection
    var coll = this.options.collection;    
    if (coll) {
    
      // bind the reset event after the collection is retrieved
      coll.bind("reset", function(data) {
        this.render();
      }, this);
    
      // fetch from the server
      coll.fetch({
        error: function() {
          coll.trigger("error");
        }
      });
    }    
  },
});
