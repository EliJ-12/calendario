import { useState, useet } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Car, Crontent, aeaer, Cl } from "cet";
mor { DiogDiaognt DiaogHadrDiaogTile, Dialog}from "@/mpnens/u/diaog";
mr { Ipu} frm "@/cmponens/u/inut";
mport { Labl } fm "@/cmponens/u/label";
imort { extaa } fom"@/cmpnens/u/textarea";
imort { earPlusEdTrsh2, Ey Shr2 } fom"uierat";
import { Qery, useMuatin, ueQueryClient } from "@tanstackrct-qery";
impor { toast } from "sonner";
itSharedEvent ieoriginal_even_id: numbr;
  shared_by_user_idnumber;
  itle: st entevent_ategeven_tory_colorstingcategory_seated_atupdated_at: stringe_b_user?r_nt?SharedEventComment}from shared_ev_idumbere_dcomntscea_a;  use?:  d  full_ar}export default funtio Sharedledar(){cos { user } = usuth(); constqueyClint = ueQueryCli();
const[currMnth,seCurMnth] =seState(w Dte()); [isViewDialogOpen,setIsViewDialogOpen]sStaefalse)
  cost [electedDayets, etelecteDayns = useStt<Shd);
  const [eectedEvt, etSeectedEvt] = useState<ShredEvent | null>(nul);
  cont eCent seeCente("");

  // Fth shared events fr curre onth
  cst { da: evens = [] } useQuery<SharedEven[]>({
    queryKey: ["/api/shred-events", curentMonth.geh), rentMonth.geFullYer()],
    quryFn: async ( => {
      const response = awaifetch(`/api/shared-events?t${currt.getMonth) + 1}&year=${Monh.gtFullYear(}`)    if (!response.ok) throw new Error("Failed to feth shared events");
      return respe.jsn();
    }
  });

  // Sr event muttion
  onst sreEventMutation = useMutation({
    mutationFn: asc (evenId: numb) => {
      const response = wait fetch"/api/shared-events", 
        mehod: "POST",
        hedes: { "Conent-Type""applicatio/json" },
        body: JON.singify({ event_id: evenIdusr_id user?.id })
      });
      if(!respse.ok) row new rror("Faile to share event");
      return response.json(    },    onSucess:  {
     queryClin.invalideQuere{ queryKey: ["/api/shared-events"] }   toast.success("Evno ompartido exitosamente"  
    onError: () => {
      toast.error("Error alompati el evo");
    }
  });

  // elete shred event muation   dleeSredEvenMutaton = usMutation({
    mutationFn: aync(id: number) >  cons esponse = await fetch(`apished-events${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Fild t delete shadevent");     return respne.json();
    },
    onSuccess: () => {
      queryClient.invalieQueries({ queryKey: ["/p/shared-events"] })oas.succss("Event elminado exitomente";
    ,
   onEro: ( =>
  tast" al limar elevnt"   }  )

  // Add comment mutation  onst addCommentMutati = ueMutation({
    muaionFn: asyn ({ sared_event_id, comment }: { sred_event_i: number; comment: string }) >  cons esponse = await fetch("apishared-event-omments", {
        method: "POST",
        headers: { "Content-Type": "ppication/jso" },
        boy: JSON.stingify({ red_event_id, comment, use_i: user.id })
      });
      if (!respnse.ok) trw new Eror"Failed to add omment");
      ret rsponse.json();
    }
   onSuccess: (=>     queryClie.invalieQueries({ queryKey: ["/p/shared-events"] })etNewComment"";
 tos.sucess"Comntaio agegad exitosamente");
    },
    onEror:() => 
    tat"oal agarlcomntaio")
  cost gtDsInMonth= (date: Date{
   return ne Dae(dategetFullYea, date.getMonth( + 1, 0).gtDate()  };
cons getFistDaOfMonth = (dt: Date) => {
    retur new Date(te.getFulYear(), dategetMonth(), 1).getDay();
  ;

  onst gtEvetForDay = (day: number) => {constdateStr=`${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2, 0)}-${String(day).padStart(2, 0)}`;returnevents.filter(event=>ve.event_date=== datStr); };
con handlDaylick = day: number) => {
  onst dyEvents = gtensForDay(day);
if(yEvens.lngth > 0) {
      etSDayEvnts(dayEts);
      seIsVieDalogOpen(true);
    }
  };

  cons handleSareEvent = (eventId: numbr) => {
   shareEventMutatin.utate(eveId);
  };
   hanleDeleteShreent = (id: number)> {
    if (confirm("¿Estás seguro de que quiereseliminrete evento comartid?")) {
    deleharentMutation.mtate(i);
    }
  };

  const hndleAddCommen = (sharId:numb) =>
 if(!newCommnttim()) etun;
   CommentMutaton.utate({ shared_evnt_id sharedEventId comment: newComment };
  }

  const handleViewEventDetails = (event: SharedEvent) => {   setSelectedEvent(event);;

  const renderCalendar = () => {
    const daysInMonth = eDaInMonh(curentMonth);
    const frstDay = etFirstDayfMonth(currentMonth);
    const days = ];

    // Eptycell fr days beore month starts
    orlet i = 0; i < firstDay; i++) {
      days.pus(<div key={`empty-${i}`} clssName="h-24 bodr borer-border/20"></di>);
    }

    // Days of te month
    for (let da = 1; ay < daysInMonth; day++) {
      const dayEvents  getEventsForDay(day);
      const Today = new Date()toDateString()  new Dte(curretMonth.gtFullYear(), currentMonth.tMoth(), y).toDateSting();

      ays.push(        iv
          ky={y}
         sm{`h-24 border border-border/20 p-2 cursor-poinr hover:bg-mued/50 transitioncolors rlativ ${isToy? 'b-pimry5' : ''}`}
          onlick={() => hneDylick(dy)}
        >
          < className="justiy-beteen items-strt mb-1">
            <sn classNam={`xt-sm fo-medium ${oday ? 'text-riary' : 'text-fregound'}`}>{day}</span>
            {dayEvents.length  0 && 
               1                MessageSquareaa="h-3 3text-mutedforegoun" />
                <span className="text-xs text-muteoregrond">{dayEvents.length}</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            {dayEvents.sice(0, 2).map((event, index) => (
              <div
                key={index}
                cassName="text-xs p-1 rounded truncate"
                 olor: event.category_color + '20', c event.category_ }}
              >
                {event.event_time && `${event.event_time} `{event.title
              <div>
            ))}
            {dayEvents.length  2 && (              div setext-xs tetuted-foreground+dayEvents.length - 2} ásdiv
            )}
                 </div>
      ;
    

    return ays;
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abrl", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noiembre", "Diciembre"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">lendaio ompartido</h1>
        <div className="text-sm text-muted-foregrund">
          Evetos compartidos por odos los usuarios
        </div>
      </div>

      {/* Caldar */}
      <Card>
        <dHede>
          <di className="flex -een itms-cter">
            <a>
            onhNames[entMonh.gtonth()]} currentMonth.getFulYar(            <Carditle>
            <dv className="fex gap-2">
          to
               rie
               ssm
               Month(new atecrrento.getFullYear), rentMonth.getMonth() - 
            >
                Antrior
              </Button>
              <Button
                aiant="utli"
               ize=""
                onClick={() > setCurrentMonth(ne Date())}
              
                Hoy              to
              
                variant="on"
                se=sm
               olcMonthnew Dte(currento.getFullYear), crrMonth.getMonth() + }
              >
                Suiene
           <B>
            </div>
          
        </Cardeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-0 mb-2["Dom", "Lun", "Mar", "Mié","Ju", "Vi", "Sáb"].map((day) => (
              <div ey={} clsName="h-10flexites-centerjusify-cnter te font-em text-md-orerud border border-border/20"
              
                }          <div>
          <div cassNam="gri gi-col-7 ap-0">{renderCalendar()}
</div>
    </CadCotent>
      </Car>

      /* View Dy Evnts Dlog*/}
      <ilog open={sViewDialogOpe} onOpenChane={setIsVewDialoOen}>
        <DilogCtnt classNa="ma-2xl">
          <DalogHeadr>
          <DiaogTl>EvosComptidos dl día</DlogTitl>    </DialogHeader>
<divclassName="space-y-3max-h-96overflow-y-auto">
{selectedDayEvent.ma((evet) =>(     <Cardkey={event.id}>
<CardContentclassName="p-4">
<divclassName="flexjustify-betweenitems-startmb-2">
<dive="flx-1"><divclassName="flexitems-centergap-2mb-2">
<div
className="w-3h-3rounded"
 style={{ backgrundColor:eventcategory_color }}></div>
<h3className="font-medium">{event.title}</h3>
{event.event_time&&<spanclassName="text-smtext-muted-foreground">{event.event_time}</span>}
</div>
{event.description&&(
<pclassName="text-smtext-muted-foregroundmb-2">{event.description}</p>
      )}    <divclassName="flexitems-centergap-2text-xstext-muted-foreground">
<span>{event.category_name}</span>
<span>•</span>
<span>Compartidopor{eventshared_by_user?full_name}</span></div>
</div>
divflex gap2"><Buttonsize="sm"variant="outline"onClick={()=>handleViewEventDetails(event)}>
<EyeclassName="h-3w-3"/>
</Button>
   {eventshared_by_user_id === user?id&&(
<Buttonsize="sm"variant="outline"onClick={()=>handleDeleteSharedEvent(eventid)}><Trash2className="h-3w-3"/>
</Button>
)}
</div>
</div>
{eventcomments&&eventcommentslength > 0 && (<divclassName="mt-3pt-3border-tborder-border/20">
             vclassName="flexitems-centergap-2mb-2">
<MessageSquareclassName="h-3w-3"/><spanclassName="text-xsfont-medium">{event.comments.length}comentarios</span>
</div>
<divclassName="space-y-2">
 {vent.omms.slic(0,).mp((commnt) => (
                          <di ky={commeid} lssName="xt-xs b-muted/30 p-2 roudd"><divclassName="font-medium">{comment.user?.full_name}au{comment.comment}</div></div>
))}
     comnts.length > 2  
                        <div cassNam="tet-xsxt-utedforeground">+{event.omms.lnth  }omentrio má</div>
                        )}
                    <div    </div>
)}            </CardContent>
</Card>
)
          </div> </DialogContent>
</Dialog>

{/*EventDetailsDialog*/}
<Dialogopen=!!selectdEent} onOpnChage={() => setSeleceEvent(null)}>
        <DialogContnt clasName="max-w-2xl">
          <DialogHeade>
            <DialogTitle>Detalles del Evento</DialogTle>
          </DalgHeader>
          {selectedEvet
        <iv classNam="ace-y-4"><Card>
<CardCtclassName="p-4"
                  <divclassName="b2       <div
 rounded"
                      style={{ backgroundColor: selectedEvent.category_color}}       ></div>
<h3lassName="fnt-ediu">{selectedEvetit}</3>
   </div>
{selectedEvt.evt_tme && (
                    <pase=text-sm text-mutedforeground mb2Hora:{selecteEent.event_tie}</>                  )}
                  setEventdescripion && (
                    p clasametetsm etmtrgod mb-2{secdEve.dscition}</p>
              )}
                  diatextxstextmteoregrond>
                    <pan>{slcategory_}<span>
            <pan cassNam="mx-2">•</spa>
<span>Compartidopor{etevent.d_b_user?_nae</span>     </iv>
</CardContent>
<Card>
         {/* Commn Sion*/}
                             <h3 className="onmeium mb>Comentario</3>
                <div className="space-y-2 max-h-8 overflow-y-auto">
                  event.comments?.map((comment)=>(
                <div key={comment.id} className="3pe">
               <div className="flex  ites-start m-">
       <spanclassName="font-meium text-sm">{comment.user?.full_name}<span>            <spanclassName="text-xstext-uted-foreground
                          new Date(met.created_at)toLoaleDateString()
                        /san    >                      p "text-sm>{comment.cmmn}</                    </                 ))}
/div>
                
                {/* AddCon */}
                <v classNm="mt-3 fex gap-2">
          Inpu
        placeholderAgregar un ario...
      v
       asNasNae="flx-1">
                  <Button 
              onClick={()=>selectedEvent&&oent(selectedEv.id)
                   nCoe || addCommentMutation.isPending}
    Eviar
        </Button>
      </div>
    </div>
  );
}
