const itemlist = document.getElementById('itemlist');
const addressEl = document.getElementById("address");
const statusValueEl = document.getElementById("statusvalue");

const tagStore = {
  tags: [],
  renderTags: function () {
    var tags = this.tags;
    if (tags.length === 0) {
      itemlist.innerHTML = "";
      return;
    } else {
      for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];
        var foundItem = null;
        if (itemlist.hasChildNodes()) {
          for (var i = 0; i < itemlist.children.length; i++) {
            if (itemlist.children[i].getAttribute('itemid') === tag.id) {
              itemlist.children[i].innerHTML = tag.id + ", isCheckoutStatePending: " + tag.isCheckoutStatePending + ", isCheckoutState: " + tag.isCheckoutState;
              foundItem = true;
              break;
            }
          }
        }
        if (!foundItem) {
          const listItem = document.createElement("li");
          listItem.setAttribute('itemid',tag.id);
          listItem.innerHTML = tag.id + ", isCheckoutStatePending: " + tag.isCheckoutStatePending + ", isCheckoutState: " + tag.isCheckoutState;
          itemlist.appendChild(listItem);
        }
      }
    }
  },
  addOrReplaceTag: function (id, reader, isComplete, isCheckoutStatePending, isCheckoutState) {
    var foundTag = false;
    for (var i = 0; i < this.tags.length; i++) {
      if (this.tags[i].id === id) {
        var updatedTag = this.tags[i];
        updatedTag.isCheckoutStatePending = isCheckoutStatePending;
        updatedTag.isCheckoutState = isCheckoutState;
        this.tags[i] = updatedTag;
        foundTag = true;
        break;
      }
    }
    if (!foundTag) {
      this.tags.push({
        id: id,
        reader: reader,
        isComplete: isComplete,
        isCheckoutStatePending: isCheckoutStatePending,
        isCheckoutState: isCheckoutState
      });
    }
    this.renderTags();
  },
  removeTag: function (id) {
    var index = this.getTagIndex(id);
    if (index !== null) {
      this.tags.splice(index, 1);
    }
    this.renderTags();
  },
  removeAllTags: function () {
    this.tags = [];
    this.renderTags();
  }
}

let wsAddress = "ws://localhost:8989/";
let webSocket;

function setAddress() {
  addressEl.value = wsAddress;
}

function getAddress() {
  var address = addressEl.value;
  wsAddress = address;
}

function sendMessage(jsonData) {
  webSocket.send(JSON.stringify(jsonData));
}

function handleEvent(event) {
  const message = JSON.parse(event.data);
  switch (message.cmd) {
    case "readerStatus":
      if (message.status === "online") {
        statusValueEl.innerHTML = "ONLINE";
      } else {
        statusValueEl.innerHTML = "OFFLINE";
      }
      break;
    case "tag":
      switch (message.reason) {
        case 'Reader empty':
          tagStore.removeAllTags();
          break;
        case 'Removed':
          tagStore.removeTag(message.id);
          break;
        case 'Complete':
        case 'Firsttime complete':
        case 'Firsttime new complete':
          // Only tags which is NOT formatted can be called for value (security) retrieval.
          if (message.id.startsWith("UID:")) {
            tagStore.addOrReplaceTag(message.id, message.reader, true, false, true);
          } else {
            tagStore.addOrReplaceTag(message.id, message.reader, true, true, null);
            sendMessage({
              "cmd": "value",
              "id": message.id,
              "fields": "checkedout"
            });
          }
          break;
        case 'Tag found':
          break;
        default:
          console.error('Unknown tag command reason: ' + message.reason);
          break;
      }
      break;
    case 'value':
      if (message.fields && message.fields.checkedout) {
        // A bit confusing, field checkedout === Deactivated.
        // What this really means is that security is Deactivated, meaning the item IS checked out.
        // And checkedout === Activated means security is activated, item is checked in.
        tagStore.addOrReplaceTag(message.id, null, null, false, message.fields.checkedout === "Deactivated");
      } else {
        console.error('Unknown value command fields: ' + message.fields);
      }
      break;
    default:
      console.error("Unknown command: "+message.cmd);
  }
};

function connect() {
  getAddress();
  console.info("Connecting to: "+wsAddress);
  webSocket = new WebSocket(wsAddress);

  webSocket.onopen = function (event) {
    statusValueEl.innerHTML = "INITIALIZING";
  };

  webSocket.onclose = function (event) {
    statusValueEl.innerHTML = "DISCONNECTED";
  };

  webSocket.onerror = function (event) {
    statusValueEl.innerHTML = "ERROR";
  };

  webSocket.onmessage = handleEvent;
}

function init() {
  setAddress();
}
init();