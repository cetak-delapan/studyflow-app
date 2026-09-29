export default function ScheduleCard({
  schedule
}) {


  function formatDate(date){

    if(!date){
      return "-";
    }


    return new Date(date)
    .toLocaleDateString(
      "id-ID",
      {
        weekday:"long",
        day:"numeric",
        month:"long",
        year:"numeric"
      }
    );

  }



return(

<div className="
bg-white
rounded-2xl
shadow
p-6
border
hover:shadow-lg
transition
">


{/* TITLE */}

<div className="
flex
items-center
gap-3
">

<div className="
text-2xl
">

📚

</div>


<h3 className="
font-bold
text-xl
text-gray-800
">

{schedule.title}

</h3>


</div>





{/* DATE */}

<div className="
mt-5
space-y-3
text-gray-600
">


<p className="
flex
items-center
gap-2
">

📅

<span>

{formatDate(schedule.date)}

</span>

</p>






{/* TIME */}

<p className="
flex
items-center
gap-2
">

⏰

<span>

{schedule.startTime || "-"}
-
{schedule.endTime || "-"}

</span>


</p>





{/* DURATION */}

<p className="
text-blue-600
font-semibold
mt-3
">

⏳ Durasi:

{" "}

{
schedule.duration
?
`${schedule.duration} jam`
:
"-"
}


</p>



</div>



</div>


)

}