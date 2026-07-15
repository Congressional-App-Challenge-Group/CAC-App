import type { SourceConfig } from "./types";
export const governmentSources:SourceConfig[]=[
  {key:"charlotte-legistar",organization:"charlotte",name:"Charlotte City Council",kind:"legistar",client:"charlottenc",url:"https://charlottenc.legistar.com/Calendar.aspx"},
  {key:"mecklenburg-legistar",organization:"mecklenburg-county",name:"Mecklenburg Board of County Commissioners",kind:"legistar",client:"mecklenburg",url:"https://mecklenburg.legistar.com/Calendar.aspx"},
  {key:"cms-boarddocs",organization:"cms",name:"CMS Board of Education",kind:"links",url:"https://go.boarddocs.com/nc/cmsnc/Board.nsf/Public"},
];
