// ==========================
// HITUNG SISA JAM
// ==========================

export function calculateRemainingHours(task){

const duration =
Number(task.duration || 0);


const progress =
Number(task.progress || 0);


return Number(
(
duration *
(100-progress)
/
100
).toFixed(2)
);

}





// ==========================
// PRIORITY SORT
// ==========================

export function sortTasks(tasks){

const priorityScore={

High:3,
Medium:2,
Low:1

};


return [...tasks].sort((a,b)=>{


const priority =
priorityScore[b.priority]
-
priorityScore[a.priority];


if(priority!==0)
return priority;


return new Date(a.deadline)
-
new Date(b.deadline);


});


}





// ==========================
// FORMAT DATE
// ==========================

function formatDate(date){

return date
.toISOString()
.split("T")[0];

}





// ==========================
// MAP HARI
// ==========================

const dayMap={

"Minggu":0,
"Senin":1,
"Selasa":2,
"Rabu":3,
"Kamis":4,
"Jumat":5,
"Sabtu":6

};






// ==========================
// CARI TANGGAL SLOT
// ==========================

function getSlotDate(
day,
startDate
){


let date =
new Date(startDate);


let target =
dayMap[day];


let current =
date.getDay();


let diff =
target-current;



if(diff<0){

diff+=7;

}



date.setDate(
date.getDate()+diff
);



return date;


}






// ==========================
// SMART GENERATOR
// ==========================

export function generateSchedule(

task,

availableSlots,

occupiedSlots=[]

){



let remaining =
calculateRemainingHours(task);



let schedules=[];


let warning=null;



let today =
new Date();



let deadline =
new Date(task.deadline);



deadline.setHours(
23,
59,
59,
999
);





let current =
new Date(today);






while(

remaining>0 &&
current<=deadline

){



for(
const slot of availableSlots
){



if(remaining<=0)
break;





const slotDate =
getSlotDate(

slot.day,

current

);





if(slotDate>deadline)
continue;





const dateString =
formatDate(slotDate);







// cek bentrok global

const conflict =
occupiedSlots.some(item=>

item.date===dateString &&

item.startTime===slot.startTime &&

item.endTime===slot.endTime

);




if(conflict){

continue;

}







const capacity =
Number(slot.duration || 0);





if(capacity<=0)
continue;






const used =
Math.min(

capacity,

remaining

);








schedules.push({

taskId:task.id,

title:task.title,

date:dateString,

startTime:slot.startTime,

endTime:slot.endTime,

duration:Number(
used.toFixed(2)
),

status:"planned"

});






remaining -= used;
current.setDate(
current.getDate()+1
);

break;




}





current.setDate(

current.getDate()+1

);



}






if(remaining>0){


warning={


type:"insufficient_time",


message:

`Waktu belajar tidak cukup. Kekurangan ${remaining} jam`,


suggestion:

"Tambahkan slot belajar atau kurangi estimasi pengerjaan"


};


}







return {


schedules,


shortage:remaining,


warning


};



}