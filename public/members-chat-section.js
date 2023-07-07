let viewMembers = true;
let membersContainer = document.getElementById('members__container')
let membersBtn = document.getElementById('members__button')
membersBtn.addEventListener('click',()=>{
if(viewMembers){
    viewMembers = false;
    membersContainer.style.display = 'none';
}else{
    viewMembers = true;
    membersContainer.style.display = 'block';
}
})

let viewMessages = true;
let messagesContainer = document.getElementById('messages__container')
let chatBtn = document.getElementById('chat__button')
chatBtn.addEventListener('click',()=>{
if(viewMessages){
    viewMessages = false;
    messagesContainer.style.display = 'none';
}else{
    viewMessages = true;
    messagesContainer.style.display = 'block';
}
})



 // Update the number of joined members
 window.addEventListener('load', () => { 
  // Get the current number of joined members
 const currentMemberCount = document.querySelectorAll('video').length;
  //   document.getElementById('members__count').innerText = currentMemberCount;
  }); 