import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";

import { useSidebar } from "../context/SidebarContext";
import StudyTimeForm from "../components/StudyTimeForm";

import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

import { db } from "../services/firebase";

import { useAuth } from "../context/AuthContext";

import { useState, useEffect } from "react";

import {
  generateSchedule,
  sortTasks
} from "../utils/plannerEngine";

import ScheduleCard from "../components/ScheduleCard";



export default function Planner(){


const {user}=useAuth();


const {
collapsed
}=useSidebar();




const [tasks,setTasks]=useState([]);

const [schedules,setSchedules]=useState([]);





// ==========================
// LOAD TASK
// ==========================

async function loadTasks(){


if(!user) return;



const q=query(

collection(db,"tasks"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



const data =
snapshot.docs.map(item=>({


id:item.id,


...item.data()


}));



setTasks(data);


}






// ==========================
// LOAD SCHEDULE
// ==========================

async function loadSchedules(){


if(!user) return;



const q=query(

collection(db,"studySchedules"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



const data =

snapshot.docs

.map(item=>({


id:item.id,


...item.data()


}))


.sort(

(a,b)=>

new Date(a.date)
-
new Date(b.date)

);



setSchedules(data);



}







useEffect(()=>{


if(user){

loadTasks();

loadSchedules();

}


},[user]);









// ==========================
// LOAD STUDY SLOT
// ==========================

async function getStudySlots(){


if(!user) return [];



const q=query(

collection(db,"studyPreferences"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



return snapshot.docs.map(item=>({


id:item.id,


...item.data()


}));



}








// ==========================
// DELETE OLD SCHEDULE
// ==========================

async function clearOldSchedules(){



const q=query(

collection(db,"studySchedules"),

where(
"userId",
"==",
user.uid
)

);



const snapshot =
await getDocs(q);



for(
const item of snapshot.docs
){


await deleteDoc(

doc(

db,

"studySchedules",

item.id

)

);


}


}









// ==========================
// GENERATE SMART SCHEDULE
// ==========================

async function handleGenerateSchedule(){



const activeTasks =

tasks.filter(

task=>

task.status==="pending"

);





if(activeTasks.length===0){


alert(
"Belum ada tugas aktif"
);


return;


}






const slots =
await getStudySlots();





if(slots.length===0){


alert(
"Tambahkan waktu belajar terlebih dahulu"
);


return;


}






// hapus jadwal lama

await clearOldSchedules();






let generated=[];



let occupiedSlots=[];



let availableSlots =
slots.map(slot=>({

...slot,

duration:Number(slot.duration || 0)

}));







const sortedTasks =
sortTasks(activeTasks);








for(
const task of sortedTasks
){



const result =

generateSchedule(

task,

availableSlots,

occupiedSlots

);





generated.push(

...result.schedules

);






// simpan slot yang sudah dipakai

result.schedules.forEach(item=>{


occupiedSlots.push({


date:item.date,


startTime:item.startTime,


endTime:item.endTime


});



});







// kurangi kapasitas slot

result.schedules.forEach(item=>{



availableSlots =

availableSlots.map(slot=>{


if(

slot.startTime===item.startTime &&

slot.endTime===item.endTime

){



return {


...slot,


duration:

Number(slot.duration)

-

Number(item.duration)


};


}



return slot;


})

.filter(

slot=>

Number(slot.duration)>0

);



});








if(result.warning){


console.log(

`${task.title}: ${result.warning.message}`

);


}



}








if(generated.length===0){



alert(
"Jadwal belum dapat dibuat"
);



return;


}








// simpan firebase

for(
const item of generated
){



await addDoc(

collection(

db,

"studySchedules"

),

{


...item,


userId:user.uid,


createdAt:new Date()


}


);


}








generated.sort(

(a,b)=>

new Date(a.date)

-

new Date(b.date)

);





setSchedules(generated);





alert(
"Jadwal belajar berhasil dibuat"
);



}









const activeTasks =

tasks.filter(

task=>

task.status==="pending"

);







const totalHours =

activeTasks.reduce(

(sum,task)=>

sum+

Number(task.duration || 0),

0

);








const nearestDeadline =


activeTasks.length>0


?


[...activeTasks].sort(

(a,b)=>

new Date(a.deadline)

-

new Date(b.deadline)

)[0]


:

null;








return(


<div className="
flex
min-h-screen
bg-gray-100
">



<Sidebar/>





<main

className={`
flex-1
p-8
transition-all
duration-300

${
collapsed

?

"ml-20"

:

"ml-64"

}

`}

>



<MobileNavbar/>

<Navbar/>






<h1 className="
text-4xl
font-bold
mt-8
">

📅 Study Planner

</h1>





<p className="
text-gray-500
mt-2
">

Atur jadwal belajar otomatis berdasarkan tugas dan deadline.

</p>








<div className="
mt-8
grid
grid-cols-1
lg:grid-cols-2
gap-6
">





<StudyTimeForm/>








<div className="
bg-white
rounded-2xl
shadow
p-6
">



<h2 className="
text-xl
font-bold
">

📊 Analisis Tugas

</h2>






<div className="
space-y-3
mt-5
">



<p>

📝 Tugas aktif:

<b>
{" "}
{activeTasks.length}
</b>

</p>





<p>

⏳ Total waktu pengerjaan:

<b>
{" "}
{totalHours} jam
</b>

</p>





<p>

🎯 Deadline terdekat:

<b>


{

nearestDeadline

?

new Date(

nearestDeadline.deadline

)

.toLocaleDateString(

"id-ID",

{

weekday:"long",

day:"numeric",

month:"long",

year:"numeric"

}

)

:

"-"


}


</b>


</p>






<button

onClick={handleGenerateSchedule}

className="
mt-6
w-full
bg-gradient-to-r
from-blue-600
to-purple-600
text-white
py-3
rounded-xl
font-semibold
"

>

Generate Jadwal Otomatis

</button>






</div>



</div>






</div>









<div className="
mt-8
">



<h2 className="
text-2xl
font-bold
mb-5
">

📅 Jadwal Belajar Saya

</h2>







<div className="
grid
gap-5
">





{

schedules.length===0


?


<div className="
bg-white
rounded-xl
p-6
text-gray-500
">

Belum ada jadwal belajar.

Silakan generate jadwal otomatis.

</div>



:


schedules.map(item=>(


<ScheduleCard


key={

item.id ||

`${item.taskId}-${item.date}-${item.startTime}`

}


schedule={item}


/>


))


}





</div>




</div>







</main>


</div>


)


}