// What leaves the phone. Today: nothing of yours, and one check for a new version of the app.
// Later: three things, each only on purpose.
import { NotYet, Section } from "./parts"

export function LeavesPhoneSection() {
  return (
    <Section id="privacy" title="What leaves your phone">
      <p>
        <b>Your Photos and Readings never leave it.</b> They are read in the app on your phone and
        are never uploaded. There are no accounts and no cloud copy.
      </p>
      <p>
        The app does one thing with the network. It asks soil.joncackler.com, which is hosted on
        GitHub Pages, for its own files: on your first visit, and then each time you open it, bring
        it back to the front or get signal again, to see whether a new version is out. That request
        carries no Photo and no Reading, only what any web request carries: your network address and
        your browser's name. Between those, the app works with no signal.
      </p>
      <NotYet testId="leaves-stub">
        <p>
          Three things are planned that would send data off the phone. Each will happen only when
          you ask for it, each will be off or hidden until then, and each will be listed here
          before it ships.
        </p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>
            <b>Plant photo identification.</b> One plant photo, the one you pick, goes to an
            identification service, and the best matches come back for you to choose from. It is
            hidden when you are offline, and no photo is sent without your tap.
          </li>
          <li>
            <b>Your location.</b> Off by default and turned on per project. The phone's position is
            used only while it is on.
          </li>
          <li>
            <b>Look-ups by location.</b> With location on and a signal, the soil map unit (from the
            USDA NRCS Soil Data Access service) and the wetland class (from the US Fish and
            Wildlife Service National Wetlands Inventory) can be looked up for a sampling point.
            The position is sent to those two public services, and what comes back is yours to
            edit.
          </li>
        </ul>
      </NotYet>
    </Section>
  )
}
