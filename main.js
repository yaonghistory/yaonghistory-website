const fades = document.querySelectorAll('.fade');

const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('show');
    }else{
      e.target.classList.remove('show');
    }
  });
},{threshold:0.2});

fades.forEach(el=>io.observe(el));