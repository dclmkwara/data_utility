"""Published weekly church information sheet for field users."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Div, H3, P, Script, Span
from faststrap import Card

from ..components.shell import app_shell


def setup_information_routes(app: Any) -> None:
    @app.get("/information")
    def information_page():
        topics_card = Card(
            Div(
                H3("Program Topics & Scriptures", cls="h6 fw-bold text-dark mb-3"),
                Div(
                    Div(Span("Sunday Bible reading", cls="text-muted small d-block"), Span("Loading…", id="info-sws-reading", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Sunday hymn", cls="text-muted small d-block"), Span("—", id="info-sws-hymn", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Sunday Worship Service", cls="text-muted small d-block"), Span("—", id="info-sws-topic", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Monday Bible study reading", cls="text-muted small d-block"), Span("—", id="info-mbs-reading", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Monday Bible Study", cls="text-muted small d-block"), Span("—", id="info-mbs-topic", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Thursday Revival Hour", cls="text-muted small d-block"), Span("—", id="info-revival-topic", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Revival information", cls="text-muted small d-block"), Span("—", id="info-revival-info", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Thursday study or training", cls="text-muted small d-block"), Span("—", id="info-sts-study", cls="fw-bold text-dark"), cls="mb-1"),
                ),
            ),
            cls="dclm-card mb-3",
        )
        hcf_card = Card(
            Div(
                H3("Home Caring Fellowship", cls="h6 fw-bold text-dark mb-3"),
                Div(
                    Div(Span("Adult HCF lesson", cls="text-muted small d-block"), Span("—", id="info-adult-hcf", cls="fw-bold text-dark"), Span("", id="info-adult-hcf-volume", cls="small text-muted ms-1"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Youth HCF lesson", cls="text-muted small d-block"), Span("—", id="info-youth-hcf", cls="fw-bold text-dark"), Span("", id="info-youth-hcf-volume", cls="small text-muted ms-1"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Children HCF lesson", cls="text-muted small d-block"), Span("—", id="info-children-hcf", cls="fw-bold text-dark"), Span("", id="info-children-hcf-volume", cls="small text-muted ms-1"), cls="mb-1"),
                ),
            ),
            cls="dclm-card mb-3",
        )
        notices_card = Card(
            Div(
                H3("Announcements", cls="h6 fw-bold text-dark mb-3"),
                P("No published notices are available.", id="info-general-announcements", cls="small text-muted mb-3"),
                P("", id="info-wedding-announcements", cls="small text-muted mb-0"),
            ),
            cls="dclm-card mb-4",
        )
        loader = Script("""(function(){
          const fields={
            'info-sws-reading':'sws_bible_reading','info-sws-hymn':'sws_hymn','info-sws-topic':'sws_topic',
            'info-mbs-reading':'mbs_bible_reading','info-mbs-topic':'mbs_topic','info-revival-topic':'revival_topic',
            'info-revival-info':'revival_info','info-sts-study':'sts_study','info-adult-hcf':'adult_hcf_lesson',
            'info-youth-hcf':'youth_hcf_lesson','info-children-hcf':'children_hcf_lesson',
            'info-general-announcements':'general_announcements','info-wedding-announcements':'wedding_announcements'
          };
          const render=item=>{
            for(const [id,key] of Object.entries(fields)){
              const node=document.getElementById(id);
              if(node) node.textContent=item[key]||(key.includes('announcements')?'No notices.':'—');
            }
            for(const [id,key] of [['info-adult-hcf-volume','adult_hcf_volume'],['info-youth-hcf-volume','youth_hcf_volume'],['info-children-hcf-volume','children_hcf_volume']]){
              const node=document.getElementById(id); if(node) node.textContent=item[key]?'· '+item[key]:'';
            }
          };
          fetch('/api/information/latest').then(async response=>{
            const data=await response.json();
            if(!response.ok||!data.ok||!data.item) throw new Error(data.error||'No published sheet is available.');
            const item=data.item;
            localStorage.setItem('dclm_latest_information',JSON.stringify(item));
            render(item);
            const status=document.getElementById('info-sheet-status');
            if(status) status.textContent=(item.region_name||'Church information')+' · Week of '+(item.date||'');
          }).catch(error=>{
            try{
              const item=JSON.parse(localStorage.getItem('dclm_latest_information')||'null');
              if(item){render(item);const status=document.getElementById('info-sheet-status');if(status)status.textContent='Offline · showing saved sheet for '+(item.region_name||'your scope')+' · '+(item.date||'');return;}
            }catch(_){ }
            const status=document.getElementById('info-sheet-status'); if(status) status.textContent=error.message;
            const reading=document.getElementById('info-sws-reading'); if(reading) reading.textContent='Connect and refresh to load the latest sheet.';
          });
        })();""")
        return app_shell(
            active_screen="information",
            page_title="Information Sheet",
            subtitle="The latest published church readings, topics, and notices.",
            content=Div(
                P("Connecting to load the latest published sheet…", id="info-sheet-status", cls="small text-muted mb-3"),
                topics_card,
                hcf_card,
                notices_card,
                loader,
            ),
        )
