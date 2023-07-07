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



 // Update the number of joined members
 window.addEventListener('load', () => { 
  // Get the current number of joined members
 const currentMemberCount = document.querySelectorAll('video').length;
  //   document.getElementById('members__count').innerText = currentMemberCount;
  }); 