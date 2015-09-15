//listen.js; a pure javascript event system with set, listen, fire, send, release, etc.

//I will pair a method to an attribute on a given object such that if the set function 
//is called to change that attribute the method will be called with the object changed and the attr's new value
//the boundobject parameter can specify an object that will receive a release() method
//so that any registrations made will be unmade when boundobject.release() is called!
function listen(obj, attrlist, method, context, boundobject){

    /* listening to undefined is badbadbad.  */
    if(!(obj instanceof Object))
       throw "A non-object was passed to listen for the attribute \""+attr+"\" and is an error. Object: "+String(obj)+".";
    
    /* if they give a boundobject, initialize it if not already */
    if(boundobject !== undefined){            
        if(boundobject['__listening__'] === undefined)
            boundobject['__listening__'] = [];
    
        if(boundobject.release === undefined)
            boundobject.release = _releaseListens;
    }
    
    /* if they pass a single string, make it a list */
    attrlist = stringToList(attrlist);

    var releaselist =  [];
    
    for(var i = 0; i < attrlist.length ; i ++){
        var attr = attrlist[i];
    
        if(obj.__listeners__ === undefined)  
            obj.__listeners__ = {};

        if(obj.__listeners__[attr] === undefined)  
            obj.__listeners__[attr] = new Array;

        obj.__listeners__[attr].push([method, context]);   
      
        releaselist.push([
            obj, attr, method, context, boundobject
        ]);
    }

    /* if they provide a bound object, push the release list onto it. */
    if(boundobject)
        boundobject.__listening__.extend(releaselist);

    return releaselist;
}

/* INTENT: the listen method returns a list that if kept can be passed to this to release only
   what was created in that listen call */
function release(releaselist){
    for(var i = 0; i < releaselist.length ; i ++){
        var entry = releaselist[i];
        var obj = entry[0], attr = entry[1], method = entry[2], context = entry[3], boundobject = entry[4];
    
        /* use that information to find the registration (going backwards) removing them. */
        var listened_list = obj.__listeners__[attr] || [];
    
        for(var j = listened_list.length-1; j != -1; j --)
            if(listened_list[j][0] == method && listened_list[j][1] == context){
                listened_list.remove(j);
                if(listened_list.length == 0)
                    delete obj.__listeners__[attr];
                break;
            } 
        
        if(boundobject){
            var listening_list = boundobject.__listening__ || [];
        
            for(var j = listening_list.length-1; j != -1; j --){
                if(listening_list[j][0] == obj && listening_list[j][1] == attr && listening_list[j][2] == method){
                    listening_list.remove(j);
                    break;
                }
            }
        }
    }
}

/* this method will be assigned to boundobjects specified when listening events.
when this method is called on that boundobject, all registrations bound will be released! */
function _releaseListens(){
    var attrs_setup_list = this.__listening__ || [];

   /* for all the recorded registrations-to-remove */
    for(var i = this.__listening__.length-1; i >= 0; i --){
        var obj = this.__listening__[i][0];
        var attr = this.__listening__[i][1];
        var method = this.__listening__[i][2];
    
        /* use that information to find the registration (going backwards) removing them. */
        var listened_list = obj.__listeners__[attr] || [];
    
        for(var j = listened_list.length-1; j >= 0; j --)
            if(listened_list[j][0] == method){
                obj.__listeners__[attr].remove(j);
                if(obj.__listeners__[attr].length == 0)
                    delete obj.__listeners__[attr];
                break;
            }   
        
        /* remove the entry as we empty it -- reset() requires this although remove() would have dumped this anyway. */
        this.__listening__.remove(i);
    }
}

/* INTENT: not only listen, but fire the method right away to evaluate first state */
function listenNow(obj, attrlist, method, context, boundobject){
    listen(obj, attrlist, method, context, boundobject);

    /* cast the attr list to list if not already (i.e. comma sep to list) */
    attrlist = stringToList(attrlist);
    
    for(var i = 0; i < attrlist.length ; i ++)
        method.call(context || this, obj[attrlist[i]]);
    
    return obj;
}

/* I will set a attribute on an obj such that any methods listened via the listen() method will fire. */
function send(obj, attr, val){ 
    if(val === undefined) val = obj[attr]; /* if no val given use current val of object */

    /* we look at the raw arguments coming in 
       to decide if we've been given one or more then
       one value, and so to either .call or .apply this
       value(s) below */
    var args = Array();
    for(var i = 0; i < arguments.length ; i ++)
        args.push(arguments[i]);

    /* determine if we have args to use or not. is either
       the list of arguments to send or false */
    args = args.length > 3 ? args.slice(2) : false;

    /* if there are no listeners, just return. */
    if(!obj.__listeners__ || !obj.__listeners__[attr])
        return;

    /* get a reference to the listeners list */
    var regAttrs = obj.__listeners__[attr];

    /* it is CRUCIALLY important to the listening algorithm that one cache the entries to 
       call BEFORE calling them in sequence, as they may alter this list during their execution 
       and while we want that, it means we must rely on a second list to iterate over everything
       correctly! */

    var to_run = [];   
    for(var i = 0; i < regAttrs.length; i ++)
        to_run.push([regAttrs[i][0], regAttrs[i][1]]);
    
    /* if we are not applying the value, call the method with a single argument */
    if(args === false){
        for(var i = 0; i < to_run.length; i ++)
            if(to_run[i][0])
                to_run[i][0].call(to_run[i][1] ? to_run[i][1] : obj, val, obj, attr);
    }

    /* if we ARE being told to apply the value (via the applyValFlag), we will use
       the list-val as the arguments to use in an .apply call. */
    else{
        for(var i = 0; i < to_run.length; i ++)
            if(to_run[i][0])
                to_run[i][0].apply(to_run[i][1] ? to_run[i][1] : obj, args);
    }   

    return obj;
}

/* exactly like send() except that if the current val of obj.attr is a function, it will be called with 
      the sent value, a very common pattern. */
function fire(obj, attr, val){ 
    /* we look at the raw arguments coming in 
       to decide if we've been given one or more then
       one value, and so to either .call or .apply this
       value(s) below */
    var args = Array();
    for(var i = 0; i < arguments.length ; i ++)
        args.push(arguments[i]);

    /* determine if we have args to use or not. is either
       the list of arguments to send or false */
    args = args.slice(2);

    /* if a function exists of that name run it. if it returns false, return that and DONT do any sends  */
    var retval;
    if(typed(obj[attr], Function))
        retval = obj[attr].apply(obj, args);

    if(retval === false)
        return false;

    /* if there are no listeners, just return the retval. */
    if(!obj.__listeners__ || !obj.__listeners__[attr])
        return retval;

    /* get a reference to the listeners list */
    var regAttrs = obj.__listeners__[attr];

    /* it is CRUCIALLY important to the listening algorithm that one cache the entries to 
       call BEFORE calling them in sequence, as they may alter this list during their execution 
       and while we want that, it means we must rely on a second list to iterate over everything
       correctly! */

    var to_run = [];   
    for(var i = 0; i < regAttrs.length; i ++)
        to_run.push([regAttrs[i][0], regAttrs[i][1]]);

    /* if we are not applying the value, call the method with a single argument */
    if(args.length === 0){
        for(var i = 0; i < to_run.length; i ++)
            if(to_run[i][0])
                to_run[i][0].call(to_run[i][1] ? to_run[i][1] : obj, val, obj, attr);
    }

    /* if we ARE being told to apply the value (via the applyValFlag), we will use
       the list-val as the arguments to use in an .apply call. */
    else{
        for(var i = 0; i < to_run.length; i ++)
            if(to_run[i][0])
                to_run[i][0].apply(to_run[i][1] ? to_run[i][1] : obj, args);
    }  

    return retval; 
}

/* I will set a attribute on an obj such that any methods listened via the listen() method will fire. */
function set(obj, attr, val){
    /* do the actual assignment */
    obj[attr] = val;

    var args = Array();
    for(var i = 0; i < arguments.length ; i ++)
        args.push(arguments[i]);

    /* call an event on this attr using .apply*/
    if(args.length > 3){
        args = args.slice(2);
        args.insert(obj, 0);
        args.insert(attr, 1);
        send.apply(this, args);
    }
    
    /* else do a normal call with .call getting val (only) */
    else
        send(obj, attr, val);

    /* return the new value of the attr, which may have changed during set! */
    return obj;
}

function toggle(obj, attr){
    set(obj, attr, !obj[attr]);
    return obj;
}

function ensure(obj, attr, val){
    obj[attr] != val && set(obj, attr, val);
    return obj;
}

function is(obj, attr){
    !obj[attr] && set(obj, attr, true);
    return obj;
}

function isnt(obj, attr){
    obj[attr] && set(obj, attr, false);
    return obj;
}

/* unset an attribute by passing undefined as the value. */
var unset = function(obj, attr){
    set(obj, attr);
    return obj;
}