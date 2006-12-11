//
// Much (most?) of this code is taken directly from the awesome comment system
// on Jack Slocum's blog. I couldn't have done it without seeing him paving the
// way.  Many, many thanks, Jack!
//  
// See http://www.jackslocum.com/yui/2006/10/09/my-wordpress-comments-system-built-with-yahoo-ui-and-yahooext/
// for the original.
//

var Comments = function() {
    
    //
    // Constants
    //
    var COMMENT_BAR_WIDTH = 20;
    
    //
    // Private variables
    //
    var blocks, chapterBody, chapterWrapper, highlightFloater, currentBlock,
        allCommentsList, commentTabs, submitCommentButton, currentCommentsList,
        commentDialog, commentForm;
    var allCommentsLoaded = false;
    var postingComment = false;
    
    //
    // Private API
    //
    
    // Event callback when a comment indicator is clicked.
    var commentBarClick = function(e) {
        setCurrentBlock(getEventTargetBlock(e));
    };
        
    // Helper: get the target from event
    var getEventTargetBlock = function(e) {
        var t = e.getTarget();
        if (t.nodeName == "SPAN") {
            t = t.parentNode;
        }
        return blocks[parseInt(t.id.substr(1), 10)];
    };
        
    // Mark a given block as currently focused
    var setCurrentBlock = function(block) {
        currentBlock = block;
        highlightFloater.setXY([chapterWrapper.getX(), block.top]);
        highlightFloater.setHeight(block.height);
        highlightFloater.show();
        commentDialog.show(block);
        if (block.indicator.hasClass("has-comments")) {
            commentTabs.activate("comment-tabs-current");
        } else {
            commentTabs.activate("comment-tabs-form");
        }
    };
    
    // Tab change callback
    var onTabChange = function(tp, tabItem) {
        if (tabItem.id == "comment-tabs-form") {
            submitCommentButton.show();
        } else if (tabItem.id == "comment-tabs-current") {
            if (currentBlock) {
                loadComments(currentBlock);
            }
            submitCommentButton.hide();
        } else if (tabItem.id == "comment-tabs-all") {
            loadComments();
            submitCommentButton.hide();
        }
    };
    
    // Load comments for a block
    var loadComments = function(block) {
        commentDialog.showLoading("Loading comments...");
        var url = document.location.pathname + "comments/";
        var cl = allCommentsList;
        if (block) {
            cl = currentCommentsList;
            url += + block.nodenum + "/";
        }
        YAHOO.util.Connect.asyncRequest("GET", url, {
            success : function(res) { cl.dom.innerHTML = res.responseText; commentDialog.hideMessage(); },
            failure : XHRFailure
        });
    };
    
    var XHRFailure = function(res) {
        commentDialog.showError(res.statusText);
    };
    
    // Handle resizing so that the floater stays in the right spot
    var onResize = function() {
       if (highlightFloater.isVisible() && currentBlock) {
           highlightFloater.setXY([chapterWrapper.getX(), currentBlock.top]);
           highlightFloater.setHeight(currentBlock.height);
       }
    };
    
    // Load all the comment counts
    var loadCommentCounts = function(callback) {
        var url = document.location.pathname + "comments/counts/";
        YAHOO.util.Connect.asyncRequest("GET", url, {
            success : function(res) { 
                var cc = eval(res.responseText);
                for (var i = 0, l = cc.length; i < l; i++) {
                    blocks[cc[i][0]].indicator.addClass("has-comments");
                    blocks[cc[i][0]].indicator.dom.innerHTML = "<span>" + cc[i][1] + "</span>";
                }
                if (callback) { callback(); }
            }
        });
    };
    
    // Sucessfully posted a comment callback
    var commentSuccess = function(res) {
        postingComment = false;
        commentDialog.hideMessage();
        if (res.responseText.substr(0, 3) == "<li") {
            // posting succeeded; switch to the comment tab
            commentTabs.activate("comment-tabs-current");
            loadCommentCounts();
        } else {
            var errors = eval(res.responseText);
            commentDialog.showError("Please fill out all required fields.");
        }
    };
        
    //
    // Public API
    //
    return {
        init : function() {     
            chapterBody = getEl("chapter-body");
            chapterWrapper = getEl("yui-main");
            submitCommentButton = getEl("comment-submit");
            currentCommentsList = getEl("current-comments-list");
            allCommentsList = getEl("all-comments-list");
            commentForm = getEl("commentform");
            
            // init the highlight floater
            highlightFloater = getEl("highlight-floater");
            highlightFloater.hide();
            highlightFloater.setOpacity(0.3);

            // IE takes the border into account in the width, so fix it...
            if (YAHOO.ext.util.Browser.isIE && !YAHOO.ext.util.Browser.isIE7) {
                highlightFloater.setWidth(chapterWrapper.getWidth() - 20);
            } else {
                highlightFloater.setWidth(chapterWrapper.getWidth());
            }
            YAHOO.util.Event.on(window, 'resize', onResize);
            
            // init comment tabs
            commentTabs = new YAHOO.ext.TabPanel("comment-tabs");
            commentTabs.addTab("comment-tabs-form", "Post a comment");
            commentTabs.addTab("comment-tabs-current", "Comments on this block");
            commentTabs.addTab("comment-tabs-all", "All comments");
            commentTabs.addTab("comment-tabs-help", "Help");
            commentTabs.onTabChange.subscribe(onTabChange);
            commentTabs.activate("comment-tabs-form");
            
            // init comment dialog
            
            // Handle size differences between browsers...
            var ctHeightFix, cfHeightFix;
            if (YAHOO.ext.util.Browser.isGecko) {
                ctHeightFix = 97;
                cfHeightFix = 280;                
            } else {
                ctHeightFix = 120;
                cfHeightFix = 300;
            }
            
            commentDialog = new CommentDialog("comments");
            commentDialog.resizer.delayedListener("resize", function(r, width, height) {
               getEl("id_comment").setSize(width-30, height-cfHeightFix);
               commentTabs.bodyEl.setSize(width-12, height-ctHeightFix); 
            });
            commentDialog.restoreState();
            
            // Find and remember all the commentable blocks
            var start = new Date().getTime();
            blocks = [];
            var parentTop = chapterBody.getTop();
            var cns = YAHOO.util.Dom.getElementsByClassName('cn', null, chapterBody.dom);
            var DH = YAHOO.ext.DomHelper;
            var cwx = chapterWrapper.getX();
            for (var i = 0, l = cns.length; i < l; i++) {
                var ci = DH.append(chapterBody.dom, {
                    tag : "div", 
                    id : "b" + i, 
                    "class" : "comment-indicator",
                    children : [{tag:"span"}]
                });
                blocks[i] = new CommentBlock(cns[i], i, ci, parentTop);
                blocks[i].indicator.mon("click", commentBarClick);
            }
            loadCommentCounts(function() {
                YAHOO.ext.util.CSS.updateRule("div.comment-indicator", "display", "block");
            });
        },
        
        close : function() {
            currentBlock = null;
            highlightFloater.hide();
            commentDialog.hide();
        },
        
        submitComment : function() {
            if (postingComment || !currentBlock) {
                return;
            }
            postingComment = true;
            commentDialog.showLoading("Posting comment...");
            commentForm.dom.nodenum.value = currentBlock.index;
            YAHOO.util.Connect.setForm(commentForm.dom);
            YAHOO.util.Connect.asyncRequest("POST", document.location.pathname + "comments/", {
                success : commentSuccess,
                failure : XHRFailure
            });
        },
        
        removeComment : function(e) {
            YAHOO.util.Connect.asyncRequest("POST", e.href, {
                success : function() {
                    var cid = e.href.split("/").reverse()[1];
                    var cel = getEl("c" + cid);
                    cel.enableDisplayMode();
                    cel.hide();
                    loadCommentCounts();
                },
                failure : XHRFailure
            });
        }
    };
}();

//
// Comment block object - just a data bucket, really
//
var CommentBlock = function(el, index, indicator, parentTop) {
    this.el = getEl(el);
    this.index = index;
    this.indicator = getEl(indicator);
    this.nodenum = index;
    this.xy = this.el.getXY();
    this.left = this.xy[0];
    this.top = this.xy[1];
    
    this.height = this.el.getHeight();
    this.bottom = this.top + this.height;
    this.indicator.setHeight(this.height);
    
    // Safari has strange bug that seems to make setXY() within a relatively
    // positioned div act strangly. This bug is fixed in the nightlies, but
    // this hack seems to work around it in the current release.
    this.indicator.dom.style.top = this.top - parentTop + "px";
};

//
// Comment "dialog" object
//
var CommentDialog = function(el) {
    this.el = getEl(el);
    this.size = this.el.getSize();
    
    // IE reports size incorrectly for hidden elements
    this.size.width = 500;
    this.size.height = 400;

    this.xy = this.el.getCenterXY();
    this.initalized = false;
    this.dd = null;
    this.messageDiv = getEl(this.el.id + "-message");
    this.hideMessage();
    this.resizer = new YAHOO.ext.Resizable(this.el, {
        minWidth: 500, 
        minHeight: 400, 
        disableTrackOver: true, 
        multiDirectional: false
    });
    this.el.setStyle('display', 'none');
};

CommentDialog.prototype = {
    restoreState : function() {
        // XXX StateManager...
        this.resizer.resizeTo(this.size.width, this.size.height);
        this.adjustViewport();
    },
    
    // adjust the viewport so that this object is in display.
    adjustViewport : function() {
        this.viewInfo = getViewportInfo();
        if (this.xy[1] + this.el.getHeight() > this.viewInfo.pageYOffset + this.viewInfo.innerHeight - 20) {
            this.xy[1] = this.viewInfo.pageYOffset + this.viewInfo.innerHeight - this.el.getHeight() - 20;
            this.el.setXY(this.xy);
        }
        if (this.xy[1] < this.viewInfo.pageYOffset + 20) {
            this.xy[1] = this.viewInfo.pageYOffset + 20;
            this.el.setXY(this.xy);
        }
    },
    
    // show the comment dialog
    show : function(block) {
        if (!this.initalized) {
            this.resizer.delayedListener("resize", this.refreshSize, this, true);
            this.dd = new YAHOO.util.DDProxy(this.el.dom, "WindowDrag");
            this.dd.setHandleElId(this.el.id + "-head");
            this.dd.startDrag = this.constraints.createDelegate(this);
            this.dd.endDrag = this.endMove.createDelegate(this);
            this.initalized = true;
        }
        if (!this.el.isVisible()) {
            this.xy[0] = block.xy[0] + 50;
            this.xy[1] = block.xy[1] - 200;
            this.el.setStyle('display', 'block');
            this.el.setBounds(this.xy[0], this.xy[1], this.size.width, this.size.height);
            this.el.show();            
        }
        this.adjustViewport();
    },
    
    // hide the dialog
    hide : function() {
        this.el.hide();
        this.el.setStyle("display", "none");
    },
    
    constraints : function() {
        this.dd.resetConstraints();
        this.viewInfo = getViewportInfo();
        this.dd.setXConstraint(this.xy[0], this.viewInfo.pageWidth - this.xy[0] - this.size.width);
        this.dd.setYConstraint(this.xy[1], this.viewInfo.pageHeight - this.xy[0] - this.size.height);
    },
    
    endMove : function(){
        YAHOO.util.DDProxy.prototype.endDrag.apply(this.dd, arguments);
        this.refreshSize();    
    },
    
    refreshSize : function(){
        this.size = this.el.getSize();
        this.xy = this.el.getXY();
    },
    
    showMessage : function(message, className) {
        this.messageDiv.dom.innerHTML = message;
        if (className) { 
            this.messageDiv.dom.className = className;
        }
        this.messageDiv.show();
    },
    
    showError : function(message) {
        this.showMessage(message, "error");
    },

    showLoading : function (message) {
        this.showMessage(message, "loading");
    },

    hideMessage : function() {
        this.messageDiv.dom.className = "";
        this.messageDiv.hide();
    }
    
    
};

//
// Helper functions
//

// Taken from http://www.quirksmode.org/viewport/compatibility.html
var getViewportInfo = function() {
    var innerWidth, innerHeight, pageXOffset, pageYOffset;

    // all except Explorer
    if (self.innerHeight) {
    	innerWidth = self.innerWidth;
    	innerHeight = self.innerHeight;
    	pageXOffset = self.pageXOffset;
    	pageYOffset = self.pageYOffset;

	// Explorer 6 Strict Mode
    } else if (document.documentElement && document.documentElement.clientHeight) {
    	innerWidth = document.documentElement.clientWidth;
    	innerHeight = document.documentElement.clientHeight;
    	pageXOffset = document.documentElement.scrollLeft;
    	pageYOffset = document.documentElement.scrollTop;

    // other Explorers
    } else if (document.body) {
        innerWidth = document.body.clientWidth;
        innerHeight = document.body.clientHeight;
    	pageXOffset = document.body.scrollLeft;
    	pageYOffset = document.body.scrollTop;
    }
    
    var pageWidth, pageHeight;
    if (document.body.scrollHeight > document.body.offsetHeight) {
        pageWidth = document.body.scrollWidth;
        pageHeight = document.body.scrollHeight;
    } else {
        pageWidth = document.body.offsetWidth;
        pageHeight = document.body.offsetHeight;
    }
    
    return {
        innerWidth: innerWidth,
        innerHeight: innerHeight,
        pageXOffset: pageXOffset,
        pageYOffset: pageYOffset,
        pageWidth: pageWidth,
        pageHeight: pageHeight
    };
};

YAHOO.ext.EventManager.onDocumentReady(Comments.init, Comments, true);